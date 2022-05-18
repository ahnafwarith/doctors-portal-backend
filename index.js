const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

// middleware
app.use(cors());
app.use(express.json());

//mongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@doctors-portal-backend.lkqdf.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
    try {
        await client.connect()
        const serviceCollection = client.db("doctors-portal").collection("services")
        const bookingCollection = client.db("doctors-portal").collection("booking")
        // uploading the data from mongoDB to server to be used in client side
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })
        // uploading the booking data in server
        app.post('/bookings', async (req, res) => {
            const query = req.body;
            const result = await bookingCollection.insertOne(query);
            res.send(result);
        })
    }
    finally {

    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send("This is the server of doctors portal project")
})

app.listen(port, () => {
    console.log('listening to port', port)
})