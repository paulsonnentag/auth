import {LocalFirstAuthSyncServer} from "./dist/index.js"

const server = new LocalFirstAuthSyncServer("localhost")

await server.listen({
    port: 3030,
    silent: false
  })
  