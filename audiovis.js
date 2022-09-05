/* wormTune Audio Visualizer */

var modes = ["None", "Bars","Scope","Spectrogram","Laser Rain"];
var drawRequest = 0;
var renderInverval;

function createVisualizer(player, context) {
    var audioSrc = context.createMediaElementSource(player);
    analyser = context.createAnalyser();
    
    var canvas = document.querySelector("canvas.vis");
    
    audioSrc.connect(analyser);
    analyser.connect(context.destination);
    
    setVisualizer(canvas, analyser, 0);

    return analyser;
};

function setVisualizer(canvas, analyser, mode = 0) {
    if (!analyser) return;
    clearInterval(renderInverval);
    var ctx = canvas.getContext("2d",{antialias: false,alpha: false});
    
    var WIDTH = canvas.width;
    var HEIGHT = canvas.height;
    
    // Set the "defaults"
    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 2048;
    
    if (mode != -1) canvas.height = 96;
    
    window.cancelAnimationFrame(drawRequest);
    if (mode == -1) { // VIDEO MODE
        canvas.height = canvas.width / 4 * 3;
        renderInverval = window.setInterval(() => {
            ctx.drawImage(audioPlayer, 0, 0, WIDTH, HEIGHT);
        }, 1000 / 24);
    } else if (mode == 0 || mode > modes.length - 1) {
        function draw() {
            drawRequest = window.requestAnimationFrame(draw);
            
            ctx.clearRect(0,0,WIDTH,HEIGHT);
            
            ctx.font = "16px Pixio";
            ctx.fillStyle = "#FFF";
            ctx.textAlign = "center";
            ctx.fillText("Click here to cycle visualizations.", WIDTH/2,HEIGHT/2);
        }
        draw();
    } else if (mode == 1) { // BAR
        analyser.fftSize = 256;
        var bufferLength = analyser.frequencyBinCount;
        var dataArray = new Uint8Array(bufferLength)
        
        var barWidth = (WIDTH / bufferLength) * 2.5;
        var barHeight;
        
        function draw() {
            ctx.clearRect(0, 0, WIDTH, HEIGHT);
            drawRequest = window.requestAnimationFrame(draw);
            
            analyser.getByteFrequencyData(dataArray);
            ctx.fillStyle = "#FFF";
            
            var x = 0;
            
            ctx.beginPath();
            for (var i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 256) * HEIGHT;
                ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
            ctx.closePath();
        }
        draw();
    } else if (mode == 2) { // SCOPE
        analyser.smoothingTimeConstant = 0;
        var dataArray = new Uint8Array(analyser.fftSize)
        
        function draw() {
            ctx.clearRect(0, 0, WIDTH, HEIGHT);
            drawRequest = window.requestAnimationFrame(draw);
            
            analyser.getByteTimeDomainData(dataArray);
            const step = WIDTH / dataArray.length;
            
            ctx.strokeStyle = "#0F0";
            
            ctx.beginPath();
            for (let i = 0; i < dataArray.length; i += 2) {
                const percent = dataArray[i] / 256;
                const x = i * step;
                const y = HEIGHT * percent;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        draw();
    } else if (mode == 3) { // SPECTROGRAM
        analyser.smoothingTimeConstant = 0;
        
        var tempCanvas = document.createElement("canvas"),
            tempCtx = tempCanvas.getContext("2d");
        tempCanvas.width = WIDTH;
        tempCanvas.height = HEIGHT;
        
        analyser.fftSize = Math.pow(2, Math.ceil(Math.log(WIDTH)/Math.log(2)));
        
        var bufferLength = analyser.frequencyBinCount;
        var dataArray = new Uint8Array(bufferLength);
        
        var start = new Date();
        //ctx.clearRect(0,0,WIDTH,HEIGHT);
        function draw() {
            drawRequest = window.requestAnimationFrame(draw);
            
            analyser.getByteFrequencyData(dataArray);
            var barHeight = WIDTH/analyser.fftSize;
            
            var now = new Date();
            if (now < new Date(start.getTime() + 20)) { return; }
            start = now;
            
            tempCtx.drawImage(ctx.canvas, 0, 0, WIDTH, HEIGHT);
            
            for (var i = 0; i < dataArray.length; i++) {
                var value = dataArray[i];
                ctx.fillStyle = 'rgb('+((value > 190) ? 255 : value)+', '+ ((value > 220) ? 255 : value-100) +', 0)';
                ctx.fillRect(WIDTH - 1, HEIGHT - i*barHeight, 1, barHeight);
            }
            ctx.translate(-1, 0);
            ctx.drawImage(tempCanvas, 0, 0, WIDTH, HEIGHT, 0, 0, WIDTH, HEIGHT);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        draw();
    } else if (mode == 4) { // RUNWAY
        analyser.smoothingTimeConstant = 0.2;
        
        var bufferLength = analyser.frequencyBinCount;
        var dataArray = new Uint8Array(bufferLength);
        
        //ctx.clearRect(0,0,WIDTH,HEIGHT);
        function draw() {
            drawRequest = window.requestAnimationFrame(draw);
            
            analyser.getByteFrequencyData(dataArray);
            
            ctx.clearRect(0,0,WIDTH,HEIGHT);
            for (var i = 0; i < dataArray.length; i++) {
                if (dataArray[i] == 0) continue;
                ctx.fillStyle = 'rgb('+dataArray[i]/4+','+dataArray[i]/2+','+dataArray[i]+')';
                ctx.fillRect((WIDTH / 2)+i, 0, 1, HEIGHT);
                ctx.fillRect((WIDTH / 2)-(i+1), 0, 1, HEIGHT);
            }
            // You are probably wondering how I got here, huh? Questioning my very sanity. Or maybe you completely understand, and as a web-developer, very well know the experience of bending the knees for Chrome in order to get something working that already works everywhere else. Since I've explained it, I think regardless, you understand now.
            ctx.font = "16px Pixio";
            ctx.fillStyle = "#4080FF0A";
            ctx.textAlign = "center";
            ctx.fillText("0x4655434B204348524F4D45",WIDTH/2,HEIGHT/2);
        }
        draw();
    }
}
