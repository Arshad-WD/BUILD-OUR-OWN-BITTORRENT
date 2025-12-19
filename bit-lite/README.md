currently 2 file we have to run
node tracker/server.js
node swarn.js -- seed   // --seed is like parameter for telling the server we are seeder 

you will get the output on where you ran server 
Peer <peerId> announce file <fileId> 
test-file/sample.txt
we have sample.txt file 
which were use to convert in to 16 bit 

if you try to run in third terminal node swarn.js --seed you likely to get an error


Already done part
Core Protocol (Done ✔)

✔ Tracker (centralized)

✔ Announce / peer discovery

✔ Torrent file (.torrent.json)

✔ infoHash as swarm identity

✔ Metadata exchange

✔ Piece splitting

✔ Piece upload/download

✔ SHA-1 piece verification

✔ Multi-peer swarm

✔ Seeder + leecher roles

✔ Disk-safe writes

✔ Multiple leechers downloading simultaneously


Remaingin Part:
Rare-piece-first selection
Parallel piece requests
Upload while downloading (true peer behavior)
Peer timeouts & retries

Choking / Unchoking
Bitfield exchange (per peer)  this part were missied by me , i use metadata instead of bitfield - please consider if continue working
Tracker peer expiry (you partially saw this)

Resume interrupted downloads
Bandwidth throttling

DHT
Peer Exchange (PEX)
Magnetic Links
