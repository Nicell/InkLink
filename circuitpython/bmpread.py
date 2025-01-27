def read_bmp(chunk_iterator, bitmap, palette):
    """Read an entire BMP file into the provided bitmap and palette"""
    # Get first chunk for headers and palette
    chunk = next(chunk_iterator)
    buffer = bytearray(chunk)
    while len(buffer) < 70:  # Need 54 for header + 16 for palette
        buffer.extend(next(chunk_iterator))
    
    # Read palette (starts at offset 54)
    for i in range(4):
        offset = 54 + (i * 4)
        b = buffer[offset]
        g = buffer[offset + 1]
        r = buffer[offset + 2]
        palette[i] = (r << 16) | (g << 8) | b
    
    changed = False
    x = 0
    y = 0
    
    # Process remaining buffer bytes
    for pos in range(70, len(buffer)):
        byte = buffer[pos]
        if not changed and (  # Only check if we haven't found changes yet
            bitmap[x, y] != ((byte >> 6) & 0x03) or
            bitmap[x + 1, y] != ((byte >> 4) & 0x03) or
            bitmap[x + 2, y] != ((byte >> 2) & 0x03) or
            bitmap[x + 3, y] != (byte & 0x03)):
            changed = True
        bitmap[x, y] = (byte >> 6) & 0x03
        bitmap[x + 1, y] = (byte >> 4) & 0x03
        bitmap[x + 2, y] = (byte >> 2) & 0x03
        bitmap[x + 3, y] = byte & 0x03
        
        x += 4
        if x >= 800:
            x = 0
            y += 1
    
    # Process remaining chunks
    while y < 480:
        chunk = next(chunk_iterator)
        for byte in chunk:
            if not changed and (  # Only check if we haven't found changes yet
                bitmap[x, y] != ((byte >> 6) & 0x03) or
                bitmap[x + 1, y] != ((byte >> 4) & 0x03) or
                bitmap[x + 2, y] != ((byte >> 2) & 0x03) or
                bitmap[x + 3, y] != (byte & 0x03)):
                changed = True
            bitmap[x, y] = (byte >> 6) & 0x03
            bitmap[x + 1, y] = (byte >> 4) & 0x03
            bitmap[x + 2, y] = (byte >> 2) & 0x03
            bitmap[x + 3, y] = byte & 0x03
            
            x += 4
            if x >= 800:
                x = 0
                y += 1
                if y >= 480:
                    break
    
    return changed 