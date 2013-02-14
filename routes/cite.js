/*
 * Citation redirecter, main code

   Copyright 2013 Matt Conway

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */

var request = require('request');
var Dom = require('xmldom').DOMParser;

/**
 * Get a parsed citation for the given text, and call the callback with it
 */
function getCitation(citation, callback) {
    request({
        // Thank you Brown University
        url: 'http://freecite.library.brown.edu/citations/create',
        form: {citation: citation},
        headers: {'Accept': 'application/xml'},
        method: 'POST'},
            function (e, r, body) {
                if (e || r.statusCode != 200) {
                    callback(null);
                    return;
                }

                console.log(body);

                // no errors
                var doc = new Dom().parseFromString(body);
                var cit = doc.getElementsByTagName('citation')[0];

                if (cit.getAttribute('valid') != 'true') {
                    callback(null);
                    return;
                }
                
                var ctx = doc.getElementsByTagNameNS('info:ofi/fmt:xml:xsd:ctx', 'context-object')[0];

                // The parsed citation is in OpenURL format
                var parsedCitation = "url_ver=" + encodeURIComponent(ctx.getAttribute('version')) +
                    "&ctx_format=" + 
                    encodeURIComponent(
                        doc.getElementsByTagNameNS('info:ofi/fmt:xml:xsd:ctx', 'format')[0].firstChild.nodeValue
                    );

                console.log(parsedCitation);

                try {
                    var journal = doc.getElementsByTagNameNS('info:ofi/fmt:xml:xsd:ctx', 'metadata')[0].childNodes[0];
                } catch (e) {
                    callback(null);
                    return;
                }

                console.log(journal);

                var chlen = journal.childNodes.length;
                for (var i = 0; i < chlen; i++) {
                    var node = journal.childNodes[i];

                    parsedCitation += '&' + node.nodeName.toLowerCase().replace(':', '.') +
                        '=' + encodeURIComponent(node.firstChild.nodeValue);
                }

                callback(parsedCitation);
            });
}
 
/**
 * Get a URL for UC eLinks
 */
function getUrlUcELinks (openurl, callback) {
    console.log(openurl);
    callback('http://ucelinks.cdlib.org:8888/sfx_local?' + openurl);
}
   
/**
 * Delegate to the proper service-specific URL constructor
 */       
function getUrlForService (service, openurl, callback) {
    if (openurl == null) callback(null);
    else if (service == 'ucelinks') getUrlUcELinks(openurl, callback);
}

exports.cite = function (req, res) {
    var citation = req.param('citation');
    var service = req.param('service');

    if (citation == undefined || citation == null || citation == '' ||
        service == undefined || service == null || service == '') {
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.write('Bad request; please include service and citation');
        res.end();
        return;
    }

    getCitation(citation, function (parsed) {
        if (parsed == null) {
            res.writeHead(500, {'Content-Type': 'text/plain'});
            res.write("Internal server error; unable to parse citation");
            res.end();
            return
        }

        // OK, this probably doesn't require a callback, but for
        // extensibility we're doing it anyhow
        var url = getUrlForService(service, parsed, function (url) {
            // TODO: 301? How does the search string affect caching?
            // 303? We want UCeLinks to have GET, but some might be picky?
            // 307?
            res.writeHead(302, {'Content-Type': 'text/plain',
                                'Location': url});

            res.write('<html><head><title>Redirect</title></head><body>' +
                      'You should have been redirected to <a href="' +
                      url + '">' + url + '</a>.' +
                      '</body></html>');

            res.end();
                
        });
    });
}