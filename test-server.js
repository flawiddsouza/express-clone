import express from './server.js'
import cors from 'cors'

const app = express()

app.use(cors())

app.use((req, res, next) => {
    req.middlewareTest = 'middle 1'
    next()
})

app.use((req, res, next) => {
    req.middlewareTest = req.middlewareTest + ' - middle 2'
    next()
})

app.use((req, res, next) => {
    req.middlewareTest = req.middlewareTest + ' - middle 3'
    next()
})

function middleware4(req, res, next) {
    req.middlewareTest = req.middlewareTest + ' - middle 4'
    next()
}

app.get('/middleware-test', middleware4, (req, res) => {
    res.send(req.middlewareTest)
})

function middleware5(req, res, next) {
    req.middlewareTest = req.middlewareTest + ' - middle 5'
    next()
}

app.get('/middleware-test-array', [middleware4, middleware5], (req, res) => {
    res.send(req.middlewareTest)
})

app.get('/', (req, res) => {
    res.send('Home')
})

app.get('/cat', (req, res) => {
    res.send('Cat')
})

app.get('/cat/:id', (req, res) => {
    res.send(req.params)
})

app.post('/cat', (req, res) => {
    res.send(req.body)
})

const port = 9000

app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`)
})
