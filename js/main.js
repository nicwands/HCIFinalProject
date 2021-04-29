async function run() {
    // load the models
    // await faceapi.loadMtcnnModel('/')
    // await faceapi.loadFaceRecognitionModel('/')

    // try to access users webcam and stream the images
    // to the video element
    console.log('in run')
    const videoEl = document.getElementById('inputVideo')
    console.log(videoEl)
    navigator.mediaDevices
        .getUserMedia({
            video: { width: { min: 1024, ideal: 1280, max: 1920 }, height: { min: 576, ideal: 720, max: 1080 } }
        })
        .then((stream) => {
            let video = videoEl
            video.srcObject = stream
            video.play()
        })
        .catch((err) => {
            console.error('error:', err)
        })
}

// listen for load event in the window
window.addEventListener('load', run)
