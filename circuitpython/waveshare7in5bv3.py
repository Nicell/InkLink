import microcontroller
import busio
from epaperdisplay import EPaperDisplay
from fourwire import FourWire

EPD_WIDTH = 800
EPD_HEIGHT = 480

CS_PIN = microcontroller.pin.GPIO15
DC_PIN = microcontroller.pin.GPIO27
RST_PIN = microcontroller.pin.GPIO26
BUSY_PIN = microcontroller.pin.GPIO25

SPI_SCK_PIN = microcontroller.pin.GPIO13
SPI_MOSI_PIN = microcontroller.pin.GPIO14

SPI_BAUD_RATE = 4_000_000

_START_SEQUENCE = (
    b"\x01\x04\x07\x07\x3f\x3f" # power setting, VGH=20V, VGL=-20V, VDH=15V, VDL=-15V
    b"\x04\x80\xff"             # power on (500ms delay)
    b"\x00\x01\x0f"             # panel setting, tri-color, OTP LUT (default)
    b"\x61\x04\x03\x20\x01\xe0" # resolution setting, source 800, gate 480
    b"\x15\x01\x00"             # dual spi off (default)
    b"\x50\x02\x11\x07"         # vcom and data interval setting
    b"\x60\x01\x22"             # tcon setting (default)
    b"\x65\x04\x00\x00\x00\x00" # gate/source start setting (default)
)

_STOP_SEQUENCE = (
    b"\x02\x00"     # power off
    b"\x07\x01\xa5" # deep sleep
)

class Waveshare7in5Bv3(EPaperDisplay):
    def __init__(self, **kwargs):
        spi = busio.SPI(SPI_SCK_PIN, MOSI=SPI_MOSI_PIN)
        bus = FourWire(spi, command=DC_PIN, chip_select=CS_PIN, reset=RST_PIN, baudrate=SPI_BAUD_RATE)
        super().__init__(
            bus,
            _START_SEQUENCE,
            _STOP_SEQUENCE,
            **kwargs,
            busy_pin=BUSY_PIN,
            busy_state=False,
            width=EPD_WIDTH,
            height=EPD_HEIGHT,
            ram_width=EPD_WIDTH,
            ram_height=EPD_HEIGHT,
            write_black_ram_command=0x10,
            write_color_ram_command=0x13,
            refresh_display_command=0x12,
            highlight_color=0xff0000
        )

        
