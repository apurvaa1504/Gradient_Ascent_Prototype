"""
Standalone copy of UNetOcean3D architecture for backend inference.
Identical to model/model.py — kept separate so the backend has no
runtime dependency on the model/ source directory.
"""

import torch
import torch.nn as nn
import torch.utils.checkpoint as checkpoint


# ---------------------------------------------------------------------------
# CBAM (2D, used only in the decoder)
# ---------------------------------------------------------------------------
class ChannelAttention(nn.Module):
    """CAM from CBAM (Woo et al. 2018)."""
    def __init__(self, channels, reduction=8):
        super().__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)
        self.mlp = nn.Sequential(
            nn.Conv2d(channels, channels // reduction, 1, bias=False),
            nn.ReLU(inplace=True),
            nn.Conv2d(channels // reduction, channels, 1, bias=False),
        )
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        avg_out = self.mlp(self.avg_pool(x))
        max_out = self.mlp(self.max_pool(x))
        return self.sigmoid(avg_out + max_out) * x


class SpatialAttention(nn.Module):
    """SAM from CBAM (Woo et al. 2018)."""
    def __init__(self, kernel_size=7):
        super().__init__()
        self.conv = nn.Conv2d(2, 1, kernel_size, padding=kernel_size // 2, bias=False)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        attn = self.sigmoid(self.conv(torch.cat([avg_out, max_out], dim=1)))
        return attn * x


class CBAM(nn.Module):
    def __init__(self, channels, reduction=8, kernel_size=7):
        super().__init__()
        self.channel_attn = ChannelAttention(channels, reduction)
        self.spatial_attn = SpatialAttention(kernel_size)

    def forward(self, x):
        x = self.channel_attn(x)
        x = self.spatial_attn(x)
        return x


# ---------------------------------------------------------------------------
# Norm helper
# ---------------------------------------------------------------------------
def _group_norm(channels, max_groups=8):
    g = min(max_groups, channels)
    while channels % g != 0:
        g -= 1
    return nn.GroupNorm(g, channels)


# ---------------------------------------------------------------------------
# 3D encoder block
# ---------------------------------------------------------------------------
class ConvBlock3D(nn.Module):
    def __init__(self, in_ch, out_ch, dropout=0.15):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv3d(in_ch, out_ch, kernel_size=3, padding=1),
            _group_norm(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv3d(out_ch, out_ch, kernel_size=3, padding=1),
            _group_norm(out_ch),
            nn.ReLU(inplace=True),
            nn.Dropout3d(dropout) if dropout > 0 else nn.Identity(),
        )

    def forward(self, x):
        return self.block(x)


# ---------------------------------------------------------------------------
# 2D decoder block
# ---------------------------------------------------------------------------
class ConvBlock2D(nn.Module):
    def __init__(self, in_ch, out_ch, use_cbam=False, dropout=0.15):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1),
            _group_norm(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1),
            _group_norm(out_ch),
            nn.ReLU(inplace=True),
            nn.Dropout2d(dropout) if dropout > 0 else nn.Identity(),
        )
        self.cbam = CBAM(out_ch) if use_cbam else nn.Identity()

    def forward(self, x):
        x = self.block(x)
        x = self.cbam(x)
        return x


def collapse_time(x):
    """(B, C, T, H, W) -> (B, C, H, W) via average pooling over time."""
    return x.mean(dim=2)


class UNetOcean3D(nn.Module):
    def __init__(self, in_channels=7, out_channels=15, base_ch=24,
                 n_days=16, use_cbam=True, use_checkpoint=False,
                 dropout=0.15, bottleneck_dropout=0.25):
        super().__init__()
        self.n_days = n_days
        self.use_checkpoint = use_checkpoint

        # ---- 3D encoder ----
        self.enc1 = ConvBlock3D(in_channels, base_ch, dropout=dropout)
        self.enc2 = ConvBlock3D(base_ch, base_ch * 2, dropout=dropout)
        self.enc3 = ConvBlock3D(base_ch * 2, base_ch * 4, dropout=dropout)
        self.enc4 = ConvBlock3D(base_ch * 4, base_ch * 8, dropout=dropout)
        self.pool3d = nn.MaxPool3d(kernel_size=2, stride=2)

        # ---- 3D bottleneck ----
        self.bottleneck = ConvBlock3D(base_ch * 8, base_ch * 16,
                                      dropout=bottleneck_dropout)
        self.time_collapse = nn.AdaptiveAvgPool3d((1, None, None))

        # ---- 2D decoder ----
        self.up4 = nn.ConvTranspose2d(base_ch * 16, base_ch * 8, 2, stride=2)
        self.dec4 = ConvBlock2D(base_ch * 16, base_ch * 8, use_cbam=use_cbam, dropout=dropout)

        self.up3 = nn.ConvTranspose2d(base_ch * 8, base_ch * 4, 2, stride=2)
        self.dec3 = ConvBlock2D(base_ch * 8, base_ch * 4, use_cbam=use_cbam, dropout=dropout)

        self.up2 = nn.ConvTranspose2d(base_ch * 4, base_ch * 2, 2, stride=2)
        self.dec2 = ConvBlock2D(base_ch * 4, base_ch * 2, use_cbam=use_cbam, dropout=dropout)

        self.up1 = nn.ConvTranspose2d(base_ch * 2, base_ch, 2, stride=2)
        self.dec1 = ConvBlock2D(base_ch * 2, base_ch, use_cbam=use_cbam, dropout=0.0)

        self.out_conv = nn.Conv2d(base_ch, out_channels, 1)

    def forward(self, x):
        B, C, T, H, W = x.shape
        pad_t = (16 - T % 16) % 16
        pad_h = (16 - H % 16) % 16
        pad_w = (16 - W % 16) % 16
        x = nn.functional.pad(x, (0, pad_w, 0, pad_h, 0, pad_t))

        def run(block, inp):
            if self.use_checkpoint and self.training:
                return checkpoint.checkpoint(block, inp, use_reentrant=False)
            return block(inp)

        e1 = run(self.enc1, x)
        e2 = run(self.enc2, self.pool3d(e1))
        e3 = run(self.enc3, self.pool3d(e2))
        e4 = run(self.enc4, self.pool3d(e3))

        b = run(self.bottleneck, self.pool3d(e4))
        b = self.time_collapse(b).squeeze(2)

        e4_2d = collapse_time(e4)
        e3_2d = collapse_time(e3)
        e2_2d = collapse_time(e2)
        e1_2d = collapse_time(e1)

        d4 = self.up4(b)
        d4 = self.dec4(torch.cat([d4, e4_2d], dim=1))

        d3 = self.up3(d4)
        d3 = self.dec3(torch.cat([d3, e3_2d], dim=1))

        d2 = self.up2(d3)
        d2 = self.dec2(torch.cat([d2, e2_2d], dim=1))

        d1 = self.up1(d2)
        d1 = self.dec1(torch.cat([d1, e1_2d], dim=1))

        out = self.out_conv(d1)
        out = out[..., :H, :W]
        return out
