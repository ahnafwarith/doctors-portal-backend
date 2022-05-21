const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
const { response } = require('express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

// middleware
app.use(cors());
app.use(express.json());

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    /* 1st layer of protection (checking for token, if no token found will return the user --> not continue in API call) */
    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    /* 2nd layer of protection */
    const token = authHeader.split(' ')[1];
    // verify a token symmetric (if confusion check documentation)
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            // if error, means token doesn't match so access is forbidden
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded
        next()
    });
}

//mongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@doctors-portal-backend.lkqdf.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect()
        // Collections
        const serviceCollection = client.db("doctors-portal").collection("services")
        const bookingCollection = client.db("doctors-portal").collection("bookings")
        const usersCollection = client.db("doctors-portal").collection("users")
        const doctorsCollection = client.db("doctors-portal").collection("doctors")

        // Verify Admin custom middleware
        const verifyAdmin = async (req, res, next) => {
            // Checking if the email has role of admin
            const requester = req.decoded.email
            const requesterAccount = await usersCollection.findOne({ email: requester })
            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                res.status(403).send({ message: 'Unauthorized' })
            }
        }

        // Getting all the users
        app.get('/users', verifyJWT, async (req, res) => {
            res.send(await usersCollection.find().toArray())
        })

        // Update or insert an existing or new user
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

        // Get an admin
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email
            const user = await usersCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin'
            res.send({ admin: isAdmin })
        })

        // Make an existing user an Admin
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email

            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' }
            };
            const result = await usersCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        // uploading the data from mongoDB to server to be used in client side
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query).project({ name: 1 });
            const result = await cursor.toArray();
            res.send(result);
        })

        // uploading doctor data
        app.post('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
            const doctorData = req.body;
            const result = await doctorsCollection.insertOne(doctorData);
            res.send(result)
        })

        // laod the doctor data
        app.get('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
            res.send(await doctorsCollection.find().toArray())
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

        // Bookings for one particular user
        app.get('/bookings', verifyJWT, async (req, res) => {
            const patient = req.query.patient
            const decodedEmail = req.decoded.email
            if (patient === decodedEmail) {
                const query = { patientEmail: patient }
                const bookings = await bookingCollection.find(query).toArray()
                res.send(bookings)
            }
            else {
                return res.status(403).send({ message: 'forbidden access' })
            }
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