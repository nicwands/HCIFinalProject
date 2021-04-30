// Global vars
const videoEl = document.getElementById('inputVideo')
const canvasEl = document.getElementById('canvas')
const camContainer = document.getElementById('camContainer')

async function run() {
    console.log(faceapi.nets)
    // load the models
    const MODEL_URL = '/public/models'
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL)
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)

    // try to access users webcam and stream the images
    // to the video element
    navigator.mediaDevices
        .getUserMedia({
            video: { width: { min: 1024, ideal: 1280, max: 1920 }, height: { min: 576, ideal: 720, max: 1080 } }
        })
        .then((stream) => {
            videoEl.srcObject = stream
        })
        .catch((err) => {
            console.error('error:', err)
        })
}

videoEl.addEventListener('play', () => {
    const canvas = faceapi.createCanvasFromMedia(videoEl)
    camContainer.append(canvas)
    console.log(videoEl)
    const displaySize = { width: videoEl.videoWidth, height: videoEl.videoHeight }
    faceapi.matchDimensions(canvas, displaySize)
    setInterval(async () => {
        const detections = await faceapi
            .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks(true)
            .withFaceExpressions()
        const resizedDetections = faceapi.resizeResults(detections, displaySize)
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
        faceapi.draw.drawDetections(canvas, resizedDetections)
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections)
    }, 300)
})

// listen for load event in the window
window.addEventListener('load', run)
