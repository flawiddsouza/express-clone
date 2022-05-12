import encodeUrl from 'encodeurl'
import statuses from 'statuses'
import merge from 'utils-merge'
import cookie from 'cookie'

// From: https://github.com/expressjs/express/blob/508936853a6e311099c9985d4c11a4b1b8f6af07/lib/request.js#L40-L84
export function addGetAndHeaderToRequest(request) {
    /**
    * Return request header.
    *
    * The `Referrer` header field is special-cased,
    * both `Referrer` and `Referer` are interchangeable.
    *
    * Examples:
    *
    *     request.get('Content-Type');
    *     // => "text/plain"
    *
    *     request.get('content-type');
    *     // => "text/plain"
    *
    *     request.get('Something');
    *     // => undefined
    *
    * Aliased as `request.header()`.
    *
    * @param {String} name
    * @return {String}
    * @public
    */

    request.get = request.header = function header(name) {
        if (!name) {
            throw new TypeError('name argument is required to req.get')
        }

        if (typeof name !== 'string') {
            throw new TypeError('name must be a string to req.get')
        }

        var lc = name.toLowerCase()

        switch (lc) {
            case 'referer':
            case 'referrer':
                return this.headers.referrer || this.headers.referer
            default:
                return this.headers[lc]
        }
    }
}

// From: https://github.com/expressjs/express/blob/158a17031a2668269aedb31ea07b58d6b700272b/lib/response.js#L758-L801
export function addSetAndHeaderToResponse(response) {
    /**
    * Set header `field` to `val`, or pass
    * an object of header fields.
    *
    * Examples:
    *
    *    response.set('Foo', ['bar', 'baz']);
    *    response.set('Accept', 'application/json');
    *    response.set({ Accept: 'text/plain', 'X-API-Key': 'tobi' });
    *
    * Aliased as `response.header()`.
    *
    * @param {String|Object} field
    * @param {String|Array} val
    * @return {ServerResponse} for chaining
    * @public
    */

    response.set = response.header = function header(field, val) {
        if (arguments.length === 2) {
            var value = Array.isArray(val)
            ? val.map(String)
            : String(val)

            // add charset to content-type
            if (field.toLowerCase() === 'content-type') {
                if (Array.isArray(value)) {
                    throw new TypeError('Content-Type cannot be set to an Array')
                }
                if (!charsetRegExp.test(value)) {
                    var charset = mime.charsets.lookup(value.split(';')[0])
                    if (charset) value += '; charset=' + charset.toLowerCase()
                }
            }

            this.setHeader(field, value)
        } else {
            for (var key in field) {
                this.set(key, field[key])
            }
        }
        return this
    }
}

// From: https://github.com/expressjs/express/blob/158a17031a2668269aedb31ea07b58d6b700272b/lib/response.js#L889-L916
export function addLocationToResponse(response) {
    /**
    * Set the location header to `url`.
    *
    * The given `url` can also be "back", which redirects
    * to the _Referrer_ or _Referer_ headers or "/".
    *
    * Examples:
    *
    *    response.location('/foo/bar').
    *    response.location('http://example.com')
    *    response.location('../login')
    *
    * @param {String} url
    * @return {ServerResponse} for chaining
    * @public
    */

    response.location = function location(url) {
        var loc = url

        // "back" is an alias for the referrer
        if (url === 'back') {
            loc = this.req.get('Referrer') || '/'
        }

        // set location
        return this.set('Location', encodeUrl(loc))
    }
}

// From: https://github.com/expressjs/express/blob/158a17031a2668269aedb31ea07b58d6b700272b/lib/response.js#L918-L980
export function addRedirectToResponse(response) {
    /**
    * Redirect to the given `url` with optional response `status`
    * defaulting to 302.
    *
    * The resulting `url` is determined by `response.location()`, so
    * it will play nicely with mounted apps, relative paths,
    * `"back"` etc.
    *
    * Examples:
    *
    *    response.redirect('/foo/bar')
    *    response.redirect('http://example.com')
    *    response.redirect(301, 'http://example.com')
    *    response.redirect('../login') // /blog/post/1 -> /blog/login
    *
    * @public
    */

    response.redirect = function redirect(url) {
        var address = url
        var body
        var status = 302

        // allow status / url
        if (arguments.length === 2) {
            if (typeof arguments[0] === 'number') {
                status = arguments[0]
                address = arguments[1]
            } else {
                deprecate('response.redirect(url, status): Use response.redirect(status, url) instead')
                status = arguments[1]
            }
        }

        // Set location header
        address = this.location(address).get('Location')

        // Support text/{plain,html} by default
        // this.format({
        //     text: function(){
                body = statuses.message[status] + '. Redirecting to ' + address
        //     },

        //     html: function(){
        //         var u = escapeHtml(address)
        //         body = '<p>' + statuses.message[status] + '. Redirecting to <a href="' + u + '">' + u + '</a></p>'
        //     },

        //     default: function(){
        //         body = ''
        //     }
        // })

        // Respond
        this.statusCode = status
        this.set('Content-Length', Buffer.byteLength(body))

        if (this.req.method === 'HEAD') {
            this.end()
        } else {
            this.end(body)
        }
    }
}

// From: https://github.com/expressjs/express/blob/158a17031a2668269aedb31ea07b58d6b700272b/lib/response.js#L729-L756
export function addAppendToResponse(response) {
    /**
    * Append additional header `field` with value `val`.
    *
    * Example:
    *
    *    response.append('Link', ['<http://localhost/>', '<http://localhost:3000/>'])
    *    response.append('Set-Cookie', 'foo=bar; Path=/; HttpOnly')
    *    response.append('Warning', '199 Miscellaneous warning')
    *
    * @param {String} field
    * @param {String|Array} val
    * @return {ServerResponse} for chaining
    * @public
    */

    response.append = function append(field, val) {
        var prev = this.get(field)
        var value = val

        if (prev) {
            // concat the new and prev vals
            value = Array.isArray(prev) ? prev.concat(val)
            : Array.isArray(val) ? [prev].concat(val)
            : [prev, val]
        }

        return this.set(field, value)
    }
}

// From: https://github.com/expressjs/express/blob/158a17031a2668269aedb31ea07b58d6b700272b/lib/response.js#L830-L887
export function addCookieToResponse(response) {
    /**
    * Set cookie `name` to `value`, with the given `options`.
    *
    * Options:
    *
    *    - `maxAge`   max-age in milliseconds, converted to `expires`
    *    - `signed`   sign the cookie
    *    - `path`     defaults to "/"
    *
    * Examples:
    *
    *    // "Remember Me" for 15 minutes
    *    res.cookie('rememberme', '1', { expires: new Date(Date.now() + 900000), httpOnly: true })
    *
    *    // same as above
    *    res.cookie('rememberme', '1', { maxAge: 900000, httpOnly: true })
    *
    * @param {String} name
    * @param {String|Object} value
    * @param {Object} [options]
    * @return {ServerResponse} for chaining
    * @public
    */

     response.cookie = function (name, value, options) {
        var opts = merge({}, options)
        var secret = this.req.secret
        var signed = opts.signed

        if (signed && !secret) {
            throw new Error('cookieParser("secret") required for signed cookies')
        }

        var val = typeof value === 'object'
        ? 'j:' + JSON.stringify(value)
        : String(value)

        if (signed) {
            val = 's:' + sign(val, secret)
        }

        if (opts.maxAge != null) {
            var maxAge = opts.maxAge - 0

            if (!isNaN(maxAge)) {
                opts.expires = new Date(Date.now() + maxAge)
                opts.maxAge = Math.floor(maxAge / 1000)
            }
        }

        if (opts.path == null) {
            opts.path = '/'
        }

        this.append('Set-Cookie', cookie.serialize(name, String(val), opts))

        return this
    }
}

// From: https://github.com/expressjs/express/blob/158a17031a2668269aedb31ea07b58d6b700272b/lib/response.js#L815-L828
export function addClearCookieToResponse(response) {
    /**
    * Clear cookie `name`.
    *
    * @param {String} name
    * @param {Object} [options]
    * @return {ServerResponse} for chaining
    * @public
    */

    response.clearCookie = function clearCookie(name, options) {
        var opts = merge({ expires: new Date(1), path: '/' }, options)

        return this.cookie(name, '', opts)
    }
}
