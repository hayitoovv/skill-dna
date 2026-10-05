"""Profile photo normalisation: only real images, re-encoded small JPEG, metadata stripped."""
import base64
import io

import pytest
from PIL import Image

from app.services import photos


def _data_url(raw: bytes, mime: str = "image/png") -> str:
    return f"data:{mime};base64,{base64.b64encode(raw).decode()}"


def _image_bytes(fmt: str, size=(640, 480), color=(30, 60, 140), **save) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format=fmt, **save)
    return buf.getvalue()


def test_png_becomes_square_jpeg():
    out = photos.normalize(_data_url(_image_bytes("PNG")))
    with Image.open(io.BytesIO(out)) as img:
        assert img.format == "JPEG" and img.size == (photos.SIDE, photos.SIDE)


def test_exif_location_is_dropped():
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (41.0, 18.0, 0.0)}  # GPS IFD
    exif[0x010F] = "PhoneMaker"
    raw = _image_bytes("JPEG", exif=exif.tobytes())
    with Image.open(io.BytesIO(raw)) as src:
        assert src.getexif()  # the upload really carries metadata
    out = photos.normalize(_data_url(raw, "image/jpeg"))
    with Image.open(io.BytesIO(out)) as img:
        assert not img.getexif()


def test_trailing_payload_does_not_survive():
    raw = _image_bytes("PNG") + b"<script>alert(1)</script>"
    out = photos.normalize(_data_url(raw))
    assert b"<script>" not in out


@pytest.mark.parametrize("data_url", [
    "data:text/html;base64," + base64.b64encode(b"<h1>x</h1>").decode(),
    _data_url(b"not an image at all"),
    _data_url(_image_bytes("GIF"), "image/png"),  # GIF disguised as PNG
    "https://example.com/a.png",
])
def test_non_images_rejected(data_url):
    with pytest.raises(photos.PhotoError):
        photos.normalize(data_url)


def test_size_limit(monkeypatch):
    monkeypatch.setattr(photos, "MAX_BYTES", 100)
    with pytest.raises(photos.PhotoError, match="2 MB"):
        photos.normalize(_data_url(_image_bytes("PNG")))


def test_huge_dimensions_rejected(monkeypatch):
    monkeypatch.setattr(photos, "MAX_PIXELS", 1000)
    with pytest.raises(photos.PhotoError):
        photos.normalize(_data_url(_image_bytes("PNG", size=(100, 100))))
