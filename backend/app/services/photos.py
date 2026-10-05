"""Profile photos: decode an uploaded data URL, verify it really is a JPEG/PNG/WebP image, and re-encode it
as a small square JPEG. Re-encoding drops EXIF (e.g. GPS location) and anything smuggled after the image data."""
import base64
import binascii
import io
import re

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 2 * 1024 * 1024
MAX_PIXELS = 40_000_000  # refuse decompression bombs before decoding
SIDE = 256
ALLOWED = {"JPEG", "PNG", "WEBP"}
_DATA_URL = re.compile(r"^data:image/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$")


class PhotoError(ValueError):
    pass


def normalize(data_url: str) -> bytes:
    m = _DATA_URL.match(data_url.strip())
    if not m:
        raise PhotoError("Faqat JPG, PNG yoki WebP rasm yuklash mumkin")
    try:
        raw = base64.b64decode(m.group(2), validate=False)
    except (binascii.Error, ValueError):
        raise PhotoError("Rasm ma’lumoti buzilgan")
    if len(raw) > MAX_BYTES:
        raise PhotoError("Rasm hajmi 2 MB dan oshmasligi kerak")
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            if probe.format not in ALLOWED:
                raise PhotoError("Faqat JPG, PNG yoki WebP rasm yuklash mumkin")
            if probe.width * probe.height > MAX_PIXELS:
                raise PhotoError("Rasm o‘lchami juda katta")
            probe.verify()
        with Image.open(io.BytesIO(raw)) as img:
            img = ImageOps.exif_transpose(img)  # respect phone camera orientation before EXIF is dropped
            img = ImageOps.fit(img.convert("RGB"), (SIDE, SIDE), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=88, optimize=True)
            return out.getvalue()
    except PhotoError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError):
        raise PhotoError("Fayl rasm emas yoki buzilgan")


def data_url(photo) -> str:
    return f"data:{photo.content_type};base64,{base64.b64encode(photo.data).decode()}"
