import express from './server.js'

const app = express()

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
