from PIL import Image
import sys

try:
    img = Image.open('cute_ai_robot.png').convert("RGBA")
    datas = img.getdata()
    newData = []
    
    # Calculate average background logic
    for item in datas:
        # Luma
        brightness = sum(item[:3]) / 3
        
        if brightness < 40:
            # Soft curved alpha dropoff for sleek black background removal
            alpha = int((max(0, brightness) / 40.0) ** 2 * 255)
            newData.append((item[0], item[1], item[2], alpha))
        else:
            newData.append((item[0], item[1], item[2], 255))
            
    img.putdata(newData)
    img.save("cute_ai_robot_transparent.png", "PNG")
    print("Masking complete.")
except Exception as e:
    print("Error:", e)
    sys.exit(1)
