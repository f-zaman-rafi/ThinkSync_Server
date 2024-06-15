const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')

const port = process.env.PORT || 8000

// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token
    console.log(token)
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log(err)
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded
        next()
    })
}

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-esohqc9-shard-00-00.okia5sv.mongodb.net:27017,ac-esohqc9-shard-00-01.okia5sv.mongodb.net:27017,ac-esohqc9-shard-00-02.okia5sv.mongodb.net:27017/?ssl=true&replicaSet=atlas-mrsszx-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
})

async function run() {
    try {

        const sessionCollection = client.db('ThinkSyncDB').collection('StudySession')
        const userCollection = client.db('ThinkSyncDB').collection('users')
        const materialsCollection = client.db('ThinkSyncDB').collection('materials')
        const bookedSessionCollection = client.db('ThinkSyncDB').collection('bookedSessions')
        const noteCollection = client.db('ThinkSyncDB').collection('notes')





        // auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({ success: true })
        })

        // Logout

        app.get('/logout', async (req, res) => {
            try {
                res
                    .clearCookie('token', {
                        maxAge: 0,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    })
                    .send({ success: true })
                console.log('Logout successful')
            } catch (err) {
                res.status(500).send(err)
            }
        })




        // User information add to the database

        app.post('/users', async (req, res) => {
            const user = req.body;

            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }

            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        // add student booked data to database

        app.post('/booked', async (req, res) => {
            const { session_id, email, title, name, averageRating, description, Registration_Start, Registration_End, Class_Start, Class_End, duration, Fee } = req.body;

            try {
                // Check if the session is already booked by the user
                const existingBooking = await bookedSessionCollection.findOne({ session_id, email });
                if (existingBooking) {
                    return res.status(400).json({ error: 'Session already booked by the user' });
                }

                // Create a new booking object with relevant session details
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
                    Fee
                };

                // Insert the new booking into the bookedSessionCollection
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
                const query = { email };
                const bookedSessions = await bookedSessionCollection.find(query).toArray();

                res.json(bookedSessions);
            } catch (error) {
                console.error('Error fetching booked sessions:', error);
                res.status(500).json({ error: 'Failed to fetch booked sessions' });
            }
        });



        // get all users

        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result)
        })

        // get specific user

        app.get('/user', async (req, res) => {
            console.log(req.query.email);
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await userCollection.find(query).toArray();
            res.send(result)
        })

        // update a user role to admin

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'Admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        // user role as a tutor\

        app.patch('/users/tutor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'Tutor'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        // Set the user role to student

        app.patch('/users/student/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: 'Student'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        // delete a user

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // get sessions data from db

        app.get('/sessions', async (req, res) => {
            const result = await sessionCollection.find().toArray();
            res.send(result)

        })

        // post new sessions data in db
        app.post('/sessions', async (req, res) => {
            try {
                const session = req.body;
                console.log(session);
                const result = await sessionCollection.insertOne(session);
                res.status(201).send({ insertedId: result.insertedId });
            } catch (error) {
                console.error('Error adding session:', error);
                res.status(500).send({ message: 'Failed to add session' });
            }
        });

        // get single sesssion from db using its _id

        app.get('/sessions/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await sessionCollection.findOne(query)
            res.send(result)
        })

        // get sessions data by tutor email

        app.get('/session', async (req, res) => {
            console.log(req.query.email);
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }

            }
            const result = await sessionCollection.find(query).toArray();
            res.send(result);
        })


        // approve session by admin

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
                // Handle error
                res.status(500).send("Error occurred while updating session.");
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
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    Status: 'Rejected'
                }
            }
            const result = await sessionCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        // Delete Session by admin 

        app.delete('/sessions/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await sessionCollection.deleteOne(query);
            res.send(result);
        })


        // Request to approve for rejected sessions

        app.patch('/sessions/pending/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    Status: 'Pending'
                }
            }
            const result = await sessionCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        // get approved data

        app.get('/session/approved', async (req, res) => {
            let query = {};
            if (req.query?.status) {
                query = { Status: req.query.status }
            }
            const result = await sessionCollection.find(query).toArray();
            res.send(result);
        })

        // post a session material

        app.post('/materials', async (req, res) => {
            const material = req.body;
            const result = await materialsCollection.insertOne(material)
            res.send(result)
        })

        // get material by tutor

        app.get('/materials', async (req, res) => {
            console.log(req.query.email);
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }

            }
            const result = await materialsCollection.find(query).toArray();
            res.send(result);
        })

        // get materials by id

        app.get('/materials/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await materialsCollection.findOne(query)
            res.send(result)
        })

        // get all materials data from db

        app.get('/materials', async (req, res) => {
            const result = await materialsCollection.find().toArray()
            res.send(result);
        })

        // update materials by id

        app.patch('/materials/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };

                // Assuming req.body contains the updated fields
                const updatedMaterial = req.body;

                const result = await materialsCollection.updateOne(query, { $set: updatedMaterial });

                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: 'Material not found' });
                }

                res.json({ updatedId: id }); // Respond with the updated ID or any other success message

            } catch (error) {
                console.error('Error updating material:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });


        // delete a material

        app.delete('/materials/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await materialsCollection.deleteOne(query);
            res.send(result);
        })

        // Endpoint to search users by name or email

        app.get('/users/search', async (req, res) => {
            const { name, email } = req.query;
            const userCollection = client.db('ThinkSyncDB').collection('users');

            try {
                let query = {};
                if (name) {
                    query.name = { $regex: new RegExp(name, 'i') };
                }
                if (email) {
                    query.email = { $regex: new RegExp(email, 'i') };
                }

                const users = await userCollection.find(query).toArray();
                res.json(users);
            } catch (err) {
                console.error('Error searching users:', err);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // personal notes post
        app.post('/note', async (req, res) => {
            const note = req.body;
            const result = await noteCollection.insertOne(note)
            res.send(result)
        })

        // get personal notes
        app.get('/note/', async (req, res) => {
            console.log(req.query.email);
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            try {
                const result = await noteCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                console.error('Error fetching notes:', error);
                res.status(500).json({ error: 'Failed to fetch notes' });
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