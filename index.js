const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

// middleware
app.use(cors());
app.use(express.json());

//mongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@doctors-portal-backend.lkqdf.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(res, res, next) {
    console.log('abc')
}

async function run() {
    try {
        await client.connect()
        const serviceCollection = client.db("doctors-portal").collection("services")
        const bookingCollection = client.db("doctors-portal").collection("bookings")
        const usersCollection = client.db("doctors-portal").collection("users")
        // update or insert an existing or new user
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const options = { upsert: true }
            const filter = { email: email };
            const updateDoc = {
                $set: user
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token })
        })

        // checking users
        app.get('/users', async (req, res) => {
            res.send(await usersCollection.find().toArray())
        })

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
        // bookings for one particular user
        app.get('/bookings', async (req, res) => {
            const patient = req.query.patient
            const authorization = req.headers.authorization
            console.log('auth header', authorization)
            const query = { patientEmail: patient }
            const bookings = await bookingCollection.find(query).toArray()
            res.send(bookings)
        })


        /* Not the proper way to query, after learning more about mongoDB we'll use aggregate lookup, pipeline, match, group */
        // updated services after booking
        app.get('/available', async (req, res) => {
            const date = req.query.date || 'May 19, 2022';
            //getting all services
            const services = await serviceCollection.find().toArray()
            // getting the booking of the user of that date
            const query = { date: date }
            const bookings = await bookingCollection.find(query).toArray()
            // find each service 
            services.forEach(service => {
                //find bookings for that service
                const serviceBookings = bookings.filter(booking => booking.treatmentName === service.name)
                // select slots for the service booking
                const bookedSlots = serviceBookings.map(booking => booking.slot)
                // select those slots which are not booked
                const available = service.slots.filter(slot => !bookedSlots.includes(slot))
                // set available slots
                service.slots = available;
            })
            //sending the result
            res.send(services)
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