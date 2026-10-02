import { io, type Socket } from "socket.io-client"

let socket: Socket | null = null

export function getSocket(token: string): Socket {
  if (!socket) {
    socket = io("/?XTransformPort=3003", {
      // Polling first so the namespace handshake (auth middleware) runs over
      // XHR; WebSocket is then upgraded for low-latency delivery.
      transports: ["polling", "websocket"],
      withCredentials: true,
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}
