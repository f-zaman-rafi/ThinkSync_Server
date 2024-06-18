const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 8000;

// Middleware configuration
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Verify Token Middleware
const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.error(err);
            return res.status(401).send({ message: 'Unauthorized access' });
        }
        req.user = decoded;
        next();
    });
};

// MongoDB connection URI
const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-esohqc9-shard-00-00.okia5sv.mongodb.net:27017,ac-esohqc9-shard-00-01.okia5sv.mongodb.net:27017,ac-esohqc9-shard-00-02.okia5sv.mongodb.net:27017/?ssl=true&replicaSet=atlas-mrsszx-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        await client.connect();

        const db = client.db('ThinkSyncDB');
        const sessionCollection = db.collection('StudySession');
        const userCollection = db.collection('users');
        const materialsCollection = db.collection('materials');
        const bookedSessionCollection = db.collection('bookedSessions');
        const noteCollection = db.collection('notes');
        const reviewCollection = db.collection('review');

        // Auth related API
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            }).send({ success: true });
        });

        // Logout
        app.get('/logout', (req, res) => {
            try {
                res.clearCookie('token', {
                    maxAge: 0,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                }).send({ success: true });
                console.log('Logout successful');
            } catch (err) {
                console.error('Logout error:', err);
                res.status(500).send(err);
            }
        });

        // User information add to the database
        app.post('/users', async (req, res) => {
            const user = req.body;

            try {
                const existingUser = await userCollection.findOne({ email: user.email });
                if (existingUser) {
                    return res.send({ message: 'User already exists', insertedId: null });
                }

                const result = await userCollection.insertOne(user);
                res.send(result);
            } catch (error) {
                console.error('Error adding user:', error);
                res.status(500).json({ error: 'Failed to add user' });
            }
        });

        // Add student booked data to the database
        app.post('/booked', async (req, res) => {
            const { session_id, email, title, name, averageRating, description, Registration_Start, Registration_End, Class_Start, Class_End, duration, Fee } = req.body;

            try {
                // Check if the session is already booked by the user
                const existingBooking = await bookedSessionCollection.findOne({ session_id, email });
                if (existingBooking) {
                    return res.status(400).json({ error: 'Session already booked by the user' });
                }

                const newBooking = {
                    session_id,
                    email,
                    title,
                    name,
                    averageRating,
                    description,
                    Registration_Start,
                    Registration_End,
                    Class_Start,
                    Class_End,
                    duration,
                    Fee,
                };

                const result = await bookedSessionCollection.insertOne(newBooking);
                res.status(201).json({ message: 'Booking successful', insertedId: result.insertedId });
            } catch (error) {
                console.error('Error booking session:', error);
                res.status(500).json({ error: 'Failed to book session' });
            }
        });

        // Get booked sessions by user email
        app.get('/booked-sessions', async (req, res) => {
            const { email } = req.query;

            try {
                const bookedSessions = await bookedSessionCollection.find({ email }).toArray();
                res.json(bookedSessions);
            } catch (error) {
                console.error('Error fetching booked sessions:', error);
                res.status(500).json({ error: 'Failed to fetch booked sessions' });
            }
        });

        // Get all users
        app.get('/users', async (req, res) => {
            try {
                const users = await userCollection.find().toArray();
                res.send(users);
            } catch (error) {
                console.error('Error fetching users:', error);
                res.status(500).json({ error: 'Failed to fetch users' });
            }
        });

        // Get specific user by email
        app.get('/user', async (req, res) => {
            const { email } = req.query;

            try {
                const user = await userCollection.find({ email }).toArray();
                res.send(user);
            } catch (error) {
                console.error('Error fetching user:', error);
                res.status(500).json({ error: 'Failed to fetch user' });
            }
        });

        // Update a user role to admin
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;

            try {
                const result = await userCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { role: 'Admin' } }
                );
                res.send(result);
            } catch (error) {
                console.error('Error updating user to admin:', error);
                res.status(500).json({ error: 'Failed to update user role to admin' });
            }
        });

        // Update a user role to tutor
        app.patch('/users/tutor/:id', async (req, res) => {
            const id = req.params.id;

            try {
                const result = await userCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { role: 'Tutor' } }
                );
                res.send(result);
            } catch (error) {
                console.error('Error updating user to tutor:', error);
                res.status(500).json({ error: 'Failed to update user role to tutor' });
            }
        });

        // Set the user role to student
        app.patch('/users/student/:id', async (req, res) => {
            const id = req.params.id;

            try {
                const result = await userCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { role: 'Student' } }
                );
                res.send(result);
            } catch (error) {
                console.error('Error updating user to student:', error);
                res.status(500).json({ error: 'Failed to update user role to student' });
            }
        });
        // Delete a user
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            try {
                const result = await userCollection.deleteOne(query);
                res.send(result);
            } catch (error) {
                console.error('Error deleting user:', error);
                res.status(500).send({ message: 'Failed to delete user' });
            }
        });

        // Get sessions data from db
        app.get('/sessions', async (req, res) => {
            try {
                const result = await sessionCollection.find().toArray();
                res.send(result);
            } catch (error) {
                console.error('Error fetching sessions:', error);
                res.status(500).send({ message: 'Failed to fetch sessions' });
            }
        });

        // Post new sessions data in db
        app.post('/sessions', async (req, res) => {
            const session = req.body;

            try {
                const result = await sessionCollection.insertOne(session);
                res.status(201).send({ insertedId: result.insertedId });
            } catch (error) {
                console.error('Error adding session:', error);
                res.status(500).send({ message: 'Failed to add session' });
            }
        });

        // Get single session from db using its _id
        app.get('/sessions/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            try {
                const result = await sessionCollection.findOne(query);
                res.send(result);
            } catch (error) {
                console.error('Error fetching session:', error);
                res.status(500).send({ message: 'Failed to fetch session' });
            }
        });

        // Get sessions data by tutor email
        app.get('/session', async (req, res) => {
            const { email } = req.query;
            const query = email ? { email } : {};

            try {
                const result = await sessionCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                console.error('Error fetching sessions by tutor email:', error);
                res.status(500).send({ message: 'Failed to fetch sessions' });
            }
        });

        // Approve session by admin
        app.patch('/sessions/approve/:id', async (req, res) => {
            const id = req.params.id;
            const { fee } = req.body; // Assuming the fee is passed in the request body
            const filter = { _id: new ObjectId(id) };
            const updatedFields = {
                $set: {
                    Status: 'Approved',
                    Fee: fee // Include the Fee field in the $set operation
                }
            };

            try {
                const result = await sessionCollection.updateOne(filter, updatedFields);
                res.send(result);
            } catch (error) {
                console.error('Error approving session:', error);
                res.status(500).send({ message: 'Failed to approve session' });
            }
        });


        // Edit Approved Session by Admin


        app.patch('/sessions/edited/:id', async (req, res) => {
            const id = req.params.id;
            const { Fee, description, Registration_Start, Registration_End, Class_Start, Class_End, duration } = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedFields = {
                $set: {
                    Fee: Fee,
                    description: description,
                    Registration_Start: Registration_Start,
                    Registration_End: Registration_End,
                    Class_Start: Class_Start,
                    Class_End: Class_End,
                    duration: duration,

                }
            };

            try {
                const result = await sessionCollection.updateOne(filter, updatedFields);
                // Handle response or send success message
                res.send("Session Edited successfully");
            } catch (error) {
                // Handle error
                console.error("Error occurred while updating session:", error);
                res.status(500).send("Internal server error");
            }
        });


        // Reject session by admin
        app.patch('/sessions/reject/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const update = { $set: { Status: 'Rejected' } };

            try {
                const result = await sessionCollection.updateOne(filter, update);
                res.send(result);
            } catch (error) {
                console.error('Error rejecting session:', error);
                res.status(500).send({ message: 'Failed to reject session' });
            }
        });

        // Delete Session by admin
        app.delete('/sessions/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            try {
                const result = await sessionCollection.deleteOne(query);
                res.send(result);
            } catch (error) {
                console.error('Error deleting session:', error);
                res.status(500).send({ message: 'Failed to delete session' });
            }
        });

        // Request to approve for rejected sessions
        app.patch('/sessions/pending/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const update = { $set: { Status: 'Pending' } };

            try {
                const result = await sessionCollection.updateOne(filter, update);
                res.send(result);
            } catch (error) {
                console.error('Error setting session to pending:', error);
                res.status(500).send({ message: 'Failed to set session to pending' });
            }
        });

        // Get approved sessions data
        app.get('/session/approved', async (req, res) => {
            const query = req.query?.status ? { Status: req.query.status } : {};

            try {
                const result = await sessionCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                console.error('Error fetching approved sessions:', error);
                res.status(500).send({ message: 'Failed to fetch approved sessions' });
            }
        });

        // Post a session material
        app.post('/materials', async (req, res) => {
            const material = req.body;

            try {
                const result = await materialsCollection.insertOne(material);
                res.send(result);
            } catch (error) {
                console.error('Error adding material:', error);
                res.status(500).send({ message: 'Failed to add material' });
            }
        });

        // Get materials by tutor email
        app.get('/materials', async (req, res) => {
            const query = req.query?.email ? { email: req.query.email } : {};

            try {
                const result = await materialsCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                console.error('Error fetching materials:', error);
                res.status(500).send({ message: 'Failed to fetch materials' });
            }
        });

        // Get material by id
        app.get('/materials/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            try {
                const result = await materialsCollection.findOne(query);
                res.send(result);
            } catch (error) {
                console.error('Error fetching material:', error);
                res.status(500).send({ message: 'Failed to fetch material' });
            }
        });

        // Get all materials data from db
        app.get('/materials', async (req, res) => {
            try {
                const result = await materialsCollection.find().toArray();
                res.send(result);
            } catch (error) {
                console.error('Error fetching all materials:', error);
                res.status(500).send({ message: 'Failed to fetch materials' });
            }
        });

        // Update material by id
        app.patch('/materials/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedMaterial = req.body;

            try {
                const result = await materialsCollection.updateOne(query, { $set: updatedMaterial });
                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: 'Material not found' });
                }
                res.json({ updatedId: id });
            } catch (error) {
                console.error('Error updating material:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // Delete a material
        app.delete('/materials/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            try {
                const result = await materialsCollection.deleteOne(query);
                res.send(result);
            } catch (error) {
                console.error('Error deleting material:', error);
                res.status(500).send({ message: 'Failed to delete material' });
            }
        });

        // Endpoint to search users by name or email
        app.get('/users/search', async (req, res) => {
            const { name, email } = req.query;
            const query = {};

            if (name) query.name = { $regex: new RegExp(name, 'i') };
            if (email) query.email = { $regex: new RegExp(email, 'i') };

            try {
                const users = await userCollection.find(query).toArray();
                res.json(users);
            } catch (error) {
                console.error('Error searching users:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // Post personal notes
        app.post('/note', async (req, res) => {
            const note = req.body;

            try {
                const result = await noteCollection.insertOne(note);
                res.send(result);
            } catch (error) {
                console.error('Error adding note:', error);
                res.status(500).send({ message: 'Failed to add note' });
            }
        });
        // Get personal notes
        app.get('/note/', async (req, res) => {
            const { email } = req.query;
            const query = email ? { email } : {};

            try {
                const result = await noteCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                console.error('Error fetching notes:', error);
                res.status(500).json({ error: 'Failed to fetch notes' });
            }
        });

        // Delete personal notes
        app.delete('/note/:id', async (req, res) => {
            const id = req.params.id;

            try {
                const result = await noteCollection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount === 1) {
                    res.json({ success: true, message: 'Note deleted successfully' });
                } else {
                    res.status(404).json({ success: false, message: 'Note not found' });
                }
            } catch (error) {
                console.error('Error deleting note:', error);
                res.status(500).json({ success: false, error: 'Failed to delete note' });
            }
        });

        // Update notes
        app.patch('/note/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedNote = req.body;

            try {
                const result = await noteCollection.updateOne(query, { $set: updatedNote });

                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: 'Note not found' });
                }

                res.json({ updatedId: id });
            } catch (error) {
                console.error('Error updating note:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // Get a single note by id
        app.get('/note/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            try {
                const note = await noteCollection.findOne(query);

                if (!note) {
                    return res.status(404).json({ error: 'Note not found' });
                }

                res.json(note);
            } catch (error) {
                console.error('Error fetching note:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // Post review
        app.post('/review', async (req, res) => {
            const review = req.body;

            try {
                const result = await reviewCollection.insertOne(review);
                res.send(result);
            } catch (error) {
                console.error('Error posting review:', error);
                res.status(500).json({ error: 'Failed to post review' });
            }
        });

        // Get reviews
        app.get('/review', async (req, res) => {
            try {
                const result = await reviewCollection.find().toArray();
                res.send(result);
            } catch (error) {
                console.error('Error fetching reviews:', error);
                res.status(500).json({ error: 'Failed to fetch reviews' });
            }
        });

        // Payment route
        app.post('/create-payment-intent', async (req, res) => {
            const { fee } = req.body;

            if (!fee || isNaN(parseFloat(fee))) {
                return res.status(400).json({ error: 'Valid fee amount is required' });
            }

            const amount = parseInt(fee * 100);

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount,
                    currency: "usd",
                    payment_method_types: ['card'],
                });

                res.json({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                console.error("Error creating payment intent:", error);
                res.status(500).json({ error: 'Failed to create payment intent' });
            }
        });


        // Send a ping to confirm a successful connection
        await client.db('admin').command({ ping: 1 })
        console.log(
            'Pinged your deployment. You successfully connected to MongoDB!'
        )
    } finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello from studySync Server..')
})

app.listen(port, () => {
    console.log(`studySync is running on port ${port}`)
})