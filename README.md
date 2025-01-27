# InkLink
### *Real-time Collaborative E-Paper Canvas*

A collaborative drawing system with a web interface that syncs to an e-paper display.

## Hardware Setup

### Required Components
- Waveshare 7.5 inch B/R/W E-Paper Display (Model: 7.5inch e-Paper B V3)
- Waveshare ESP32 E-Paper Driver Board
- 3D printed case (3 files needed - TBD: add links to STL files)
- USB-C cable for power
- M3 screws for assembly (TBD: specify size and quantity)

### Assembly Instructions
1. Print the three case components (TBD: add specific print settings)
2. Mount the ESP32 board to the base using M3 screws
3. Connect the e-paper display to the ESP32 board via the ribbon cable
4. Secure the display in the frame
5. Attach the back cover

## Software Setup

### E-Paper Display Setup
1. Install CircuitPython on the ESP32 board:
   - Download the latest CircuitPython .uf2 file for ESP32-S2
   - Put the board in bootloader mode by holding BOOT while pressing RESET
   - Copy the .uf2 file to the mounted drive

2. Install required CircuitPython libraries:
   ```
   adafruit_connection_manager
   adafruit_requests
   displayio
   ```

3. Configure WiFi:
   - Create `settings.toml` in the CIRCUITPY drive:
   ```toml
   WIFI_SSID="your_wifi_name"
   WIFI_PASSWORD="your_wifi_password"
   ```

4. Copy the CircuitPython files to the CIRCUITPY drive:
   - `waveshare7in5bv3.py`
   - `draw.py`
   - `bmpread.py`

### Server Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd inklink
```

2. Create `.env` file:

```
VITE_WEB_TITLE=InkLink
CLEAR_CRON="0 4 " # Optional: Clear drawing daily at 4am
```

3. Deploy using Docker Compose:
```bash
docker compose up -d
```

The web interface will be available at `http://localhost` and the e-paper display will automatically connect and sync with the server.

## Development Setup

TBD: Add local development instructions

## Contributing

TBD: Add contribution guidelines

## License

TBD: Add license information
