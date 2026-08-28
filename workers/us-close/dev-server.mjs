#!/usr/bin/env node
import http from "node:http";
import { createHandler, memoryKv } from "./src/logic.js";

var port = Number(process.env.PORT || 8787);
var kv = memoryKv();
var handle = createHandler({ kv: kv });

var server = http.createServer(async function (req, res) {
  try {
    var headers = new Headers();
    Object.keys(req.headers).forEach(function (key) {
      var value = req.headers[key];
      if (value == null) return;
      if (Array.isArray(value)) headers.set(key, value.join(", "));
      else headers.set(key, String(value));
    });
    var url = "http://127.0.0.1:" + port + req.url;
    var request = new Request(url, { method: req.method, headers: headers });
    var response = await handle(request, { US_CLOSE: kv });
    res.statusCode = response.status;
    response.headers.forEach(function (value, key) {
      res.setHeader(key, value);
    });
    var buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: false, error: "dev-server" }));
  }
});

server.listen(port, "127.0.0.1", function () {
  console.log("us-close worker dev http://127.0.0.1:" + port + "/quotes");
});
