"""
Model loader — reads UNetOcean3D from the checkpoint file and extracts
normalization statistics stored alongside the weights.

Only the checkpoints/ directory is touched; train.py and dataset.py
are never imported.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import torch

from model_def import UNetOcean3D

logger = logging.getLogger(__name__)

CHECKPOINT_PATH = (
    Path(__file__).parent.parent
    / "model"
    / "checkpoints"
    / "best_model_0.6787_epoch16.pt"
)


@dataclass
class _ModelState:
    model: UNetOcean3D | None = None
    device: torch.device | None = None
    # Normalization stats saved inside the checkpoint (per channel)
    input_mean: np.ndarray | None = None   # (7, 1, 1)
    input_std: np.ndarray | None = None    # (7, 1, 1)
    target_mean: np.ndarray | None = None  # (15, 1, 1)
    target_std: np.ndarray | None = None   # (15, 1, 1)
    n_days: int = 16


# Singleton accessed by inference.py and main.py
MODEL = _ModelState()


def _detect_base_ch(state_dict: dict) -> int:
    """Read base_ch from the first encoder conv weight shape."""
    for prefix in ("", "_orig_mod."):
        key = f"{prefix}enc1.block.0.weight"
        if key in state_dict:
            return state_dict[key].shape[0]
    raise KeyError("Cannot detect base_ch: 'enc1.block.0.weight' not found in checkpoint.")


def _detect_use_cbam(state_dict: dict) -> bool:
    for prefix in ("", "_orig_mod."):
        if f"{prefix}dec4.cbam.channel_attn.mlp.0.weight" in state_dict:
            return True
    return False


def _strip_compile_prefix(state_dict: dict) -> dict:
    """Remove the '_orig_mod.' prefix added by torch.compile."""
    return {k.removeprefix("_orig_mod."): v for k, v in state_dict.items()}


def load_model() -> None:
    """
    Load the checkpoint and initialise the global MODEL singleton.
    Called once during FastAPI startup lifespan.
    """
    if not CHECKPOINT_PATH.exists():
        raise FileNotFoundError(
            f"Checkpoint not found at {CHECKPOINT_PATH}. "
            "Make sure the model/checkpoints/ directory is present."
        )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("Loading checkpoint from %s onto %s", CHECKPOINT_PATH, device)

    ckpt = torch.load(CHECKPOINT_PATH, map_location=device, weights_only=False)

    raw_sd = ckpt["model_state_dict"]
    state_dict = _strip_compile_prefix(raw_sd)

    base_ch = _detect_base_ch(state_dict)
    use_cbam = _detect_use_cbam(state_dict)
    n_days = int(ckpt.get("n_days", 16))

    logger.info("Detected: base_ch=%d  use_cbam=%s  n_days=%d", base_ch, use_cbam, n_days)

    model = UNetOcean3D(
        in_channels=7,
        out_channels=15,
        base_ch=base_ch,
        n_days=n_days,
        use_cbam=use_cbam,
        # dropout values don't matter in eval() mode — Dropout layers are disabled
        dropout=0.15,
        bottleneck_dropout=0.25,
    ).to(device)

    missing, unexpected = model.load_state_dict(state_dict, strict=False)
    if missing:
        logger.warning("Missing keys in checkpoint: %s", missing)
    if unexpected:
        logger.warning("Unexpected keys in checkpoint: %s", unexpected)

    model.eval()

    # Store everything in singleton
    MODEL.model = model
    MODEL.device = device
    MODEL.n_days = n_days
    MODEL.input_mean = np.array(ckpt["input_mean"], dtype=np.float32)
    MODEL.input_std = np.array(ckpt["input_std"], dtype=np.float32)
    MODEL.target_mean = np.array(ckpt["target_mean"], dtype=np.float32)
    MODEL.target_std = np.array(ckpt["target_std"], dtype=np.float32)

    logger.info(
        "Model ready — %d parameters",
        sum(p.numel() for p in model.parameters()),
    )
