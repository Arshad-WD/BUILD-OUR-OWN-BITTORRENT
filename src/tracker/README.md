Tracker
know who else is donwloading this file?

Tracker API
POST /announce

request:

{
  "infoHash": "abc123",
  "peerId": "peerA",
  "ip": "127.0.0.1",
  "port": 6001
}

response:

{
  "peers": [
    { "ip": "127.0.0.1", "port": 6002, "peerId": "peerB" }
  ]
}


No DB.
In-memory only.
We restart → swarm resets (fine).


File chunking
File size: any
Piece size: 256 KB (fixed)
Each piece:
Index
SHA-1 hash
Raw bytes
Why hashing matters
Without hashing:
Malicious peers corrupt file
Silent corruption
No trust
Hash = trust anchor