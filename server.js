import { createServer, METHODS } from 'http'
import { match } from 'path-to-regexp'
import { createReadStream } from 'fs'
import serveStatic from 'serve-static'

function bodyParser(request) {
    if(request.get('Content-Type') === 'application/x-www-form-urlencoded') {
        let fields = request.rawBody.split('&')
        let returnObject = {}
        fields.forEach(field => {
            let splitField = field.split('=')
            returnObject[splitField[0]] = splitField[1]
        })
        return returnObject
    }

    if(request.get('Content-Type') === 'application/json') {
        try {
            return JSON.parse(request.rawBody)
        } catch {}
    }

    return {}
}

function requestWrapper(request) {
    return {
        get headers() {
            return request.headers
        },
        // Returns the specified HTTP request header field (case-insensitive match). The Referrer and Referer fields are interchangeable.
        get(header) {
            let headerLowerCased = header.toLowerCase()
            if(headerLowerCased in this.headers) {
                return this.headers[headerLowerCased]
            }
        },
        // Contains the request protocol string: either http or (for TLS requests) https.
        get protocol() {
            return request.connection && request.connection.encrypted ? 'https' : 'http'
        },
        // Contains the hostname derived from the Host HTTP header.
        get hostname() {
            return request.headers.host
        },
        get originalUrl() {
            return request.originalUrl
        },
        get url() {
            return request.url
        },
        get parsedUrl() {
            return new URL(this.url, `${this.protocol}://${this.hostname}`)
        },
        // Contains the path part of the request URL.
        get path() {
            return this.parsedUrl.pathname
        },
        // This property is an object containing a property for each query string parameter in the route
        get query() {
            return this.parsedUrl.searchParams
        },
        // This property is an object containing properties mapped to the named route “parameters”. For example, if you have the route /user/:name, then the "name" property is available as req.params.name. This object defaults to {}.
        params: {},
        // Contains a string corresponding to the HTTP method of the request: GET, POST, PUT, and so on.
        get method() {
            return request.method
        },
        get rawBody() {
            return request.rawBody
        },
        // Contains key-value pairs of data submitted in the request body. By default, it will return {}, and is populated when request Content-Type is set to application/x-www-form-urlencoded or application/json
        get body() {
            return bodyParser(this)
        }
    }
}

import { addSetAndHeaderToResponse, addLocationToResponse, addRedirectToResponse, addClearCookieToResponse, addCookieToResponse, addAppendToResponse } from './helpers.js'

function responseWrapper(response, request) {
    // Sets the HTTP status for the response. It is a chainable alias of Node's response.statusCode.
    response.status = (code) => {
        response.statusCode = code
        return response
    }

    // Sends the HTTP response.
    // The body parameter can be a String, an object, Boolean, or an Array.
    response.send = (body) => {
        if(typeof body === 'string') {
            response.end(body)
        }

        if(typeof body === 'object') {
            response.end(JSON.stringify(body))
        }

        if(typeof body === 'undefined') {
            response.end()
        }
    }

    response.sendFile = (path) => {
        createReadStream(path).pipe(response)
    }

    response.req = request

    response.get = (field) => {
        return response.getHeader(field)
    }

    addSetAndHeaderToResponse(response)
    addLocationToResponse(response)
    addRedirectToResponse(response)
    addAppendToResponse(response)
    addCookieToResponse(response)
    addClearCookieToResponse(response)

    return response
}

function handleRoute(request, response, middleware, route) {
    if(route) {
        middleware = [...middleware, ...route.middleware]
    }
    let callbackStack = []
    if(route) {
        callbackStack.push(() => route.callback(request, response))
    } else {
        callbackStack.push((...args) => {
            if(args.length === 1 && args[0] instanceof Error) {
                const error = 'Error: ' + args[0].message
                console.error(error)
                response.status(500).send(error)
            }
            response.status(404).send(`Cannot ${request.method} ${request.path}`)
        })
    }
    for(let i=middleware.length - 1; i>= 0; i--) {
        const callback = callbackStack.pop()
        function next(...args) {
            if(args.length === 1 && args[0] instanceof Error) {
                const error = 'Error: ' + args[0].message
                console.error(error)
                response.status(500).send(error)
            } else {
                callback(...args)
            }
        }
        if(request.path.startsWith(middleware[i].root)) {
            callbackStack.push(() => middleware[i].callback(request, response, next))
        } else {
            callbackStack.push(next)
        }
    }
    callbackStack[0]()
}

class App {
    constructor() {
        this.routes = []
        this.middleware = []
    }

    use(...args) {
        let root = '/'
        let callback = null
        if(args.length === 1) {
            callback = args[0]
        }
        if(args.length === 2) {
            root = args[0]
            callback = args[1]
        }
        this.middleware.push({ root, callback })
    }

    addRoute(method, path, callback) {
        this.routes.push({
            method: method.toUpperCase(),
            path: path,
            callback: callback
        })
    }

    addRoute(method, ...args) {
        const path = args[0]
        let middleware = []
        let callback = null

        if(args.length === 2) {
            callback = args[1]
        }

        if(args.length === 3) {
            middleware = { root: path, callback: args[1] }
            callback = args[2]
        }

        this.routes.push({
            method: method.toUpperCase(),
            path: path,
            callback: callback,
            middleware: Array.isArray(middleware) ? middleware : [middleware]
        })
    }

    requestHandler(request, response) {
        let routesToActOn = this.routes.filter(route => route.method === request.method).filter(route => {
            let routeMatches = match(route.path, { decode: decodeURIComponent })
            let result = routeMatches(request.path)
            if(result === false) {
                return false
            } else {
                route.params = result.params
                return true
            }
        })

        if(routesToActOn.length > 0) {
            routesToActOn.forEach(route => {
                if('params' in route) {
                    request.params = route.params
                }
                handleRoute(request, response, this.middleware, route)
            })
        } else {
            // global middleware should still run even if there are no routes to act on
            handleRoute(request, response, this.middleware)
        }
    }

    listen(port, callback) {
        const server = createServer((request, response) => {
            let data = ''

            request.on('data', chunk => {
                data += chunk
            })

            request.on('end', () => {
                if(data) {
                    request.rawBody = data
                }
                const wrappedRequest = requestWrapper(request)
                this.requestHandler(wrappedRequest, responseWrapper(response, wrappedRequest))
            })
        })

        server.listen(port, callback)
    }
}

METHODS.forEach(method => {
    App.prototype[method.toLowerCase()] = function(...args) {
        return this.addRoute(method, ...args)
    }
})

const appFunc = () => {
    return new App
}

appFunc.static = serveStatic

export default appFunc
