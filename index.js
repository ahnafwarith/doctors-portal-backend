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
        const bookingCollection = client.db("doctors-portal").collection("bookings")
        // uploading the data from mongoDB to server to be used in client side
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })
        // uploading the booking data in server
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatmentName, date: booking.date, name: booking.patientName }
            const exists = await bookingCollection.findOne(query)
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        })
        // updated services after booking
        app.get('/available', async (req, res) => {
            const date = req.query.date;
            console.log(date)
            //getting all services
            const services = await serviceCollection.find().toArray()
            // getting the booking of the user of that date
            const query = { date: date }
            const bookings = await bookingCollection.find(query).toArray()
            // find each service find bookings for that service


            //sending the result
            res.send(bookings)
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