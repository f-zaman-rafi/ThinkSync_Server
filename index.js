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
    res.send('Hello from StayVista Server..')
})

app.listen(port, () => {
    console.log(`StayVista is running on port ${port}`)
})