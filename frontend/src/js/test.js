const canvas = document.getElementById('canvas-blocks');
const ctx = canvas.getContext('2d');

const imagePath = '/images/dirt.png';
const image = new Image();
image.src = imagePath;

image.onload = () => {
    const offscreenCanvas = document.createElement('canvas');
    const offscreenCtx = offscreenCanvas.getContext('2d');
    
    const imgWidth = image.width;
    const imgHeight = image.height;
    
    offscreenCanvas.width = imgWidth;
    offscreenCanvas.height = imgHeight;
    
    offscreenCtx.drawImage(image, 0, 0, imgWidth, imgHeight);
    
    const imageData = offscreenCtx.getImageData(0, 0, imgWidth, imgHeight);
    const data = imageData.data;
    
    const pixelScale = 32;
    
    canvas.width = imgWidth * pixelScale;
    canvas.height = imgHeight * pixelScale;
    
    for (let y = 0; y < imgHeight; y++) {
        for (let x = 0; x < imgWidth; x++) {
            const index = (y * imgWidth + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const a = data[index + 3] / 255;
            
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
            ctx.fillRect(x * pixelScale, y * pixelScale, pixelScale, pixelScale);
        }
    }
};

image.onerror = () => {
    console.error("Impossible de charger l'image. Vérifiez le chemin.");
};