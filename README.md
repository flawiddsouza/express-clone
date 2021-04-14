Usage:
```
npm install https://github.com/flawiddsouza/express-clone
```

Sample Code:
```js
import express from 'express-clone'

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
```

To Develop
```
git clone https://github.com/flawiddsouza/express-clone
cd express-clone
npm install
```

While developing, to test the server:
```
node test-server.js
```

Core code is in server.js
