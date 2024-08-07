import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import morgan from "morgan";


const app = express();

const server = http.createServer({ allowEIO3: true});
const io = new SocketIOServer(server, {
    cors: {
        origin: '*',
    },
    transports:['websocket','polling'],

});
const PORT = process.env.SOCKET_PORT || 3000;

server.listen(443, () => {
  console.log(`Server running on port ${PORT}`);
});


app.use(cors())
app.use(express.json());
app.use(morgan("dev"));
app.use(express.urlencoded({extended: true, limit: "16kb"}))

import {Users} from './models/user.model.js'
import {Messages} from './models/message.model.js';
import {Conversations} from './models/chat.model.js';



let users = [];
let onlineUsers={};

// <<<-----------------------socket.io code start------------------------------->>>>



io.on('connection', socket => {
    console.log('User connected', socket.id);

     // Handle user online event
     socket.on('userOnline', async(userId) => {
        onlineUsers[userId] = socket.id;
        await Users.findByIdAndUpdate(userId, { online: true });
        io.emit('updateUserStatus', { userId, status: 'online' });
    });

    socket.on("connect_error", (err) => {
        console.log(`connect_error due to ${err.message}`);
      });

    socket.on('addUser', userId => {
        const isUserExist = users.find(user => user.userId === userId);
        if (!isUserExist) {
            const user = { userId, socketId: socket.id };
            users.push(user);
            io.emit('getUsers', users);
        }
    });

    socket.on('sendMessage', async ({ senderId, receiverId, message, conversationId }) => {
        try {
            // If conversationId is 'new', find or create the conversation
            if (conversationId === 'new') {
                let conversation = await Conversations.findOne({ members: { $all: [senderId, receiverId] } });
                if (!conversation) {
                    conversation = new Conversations({ members: [senderId, receiverId] });
                    await conversation.save();
                }
                conversationId = conversation._id;
            }
    
            // Save the new message
            const newMessage = new Messages({ conversationId, senderId, message });
            await newMessage.save();
    
            // Find receiver and sender in the current users
            const receiver = users.find(user => user.userId === receiverId);
            const sender = users.find(user => user.userId === senderId);
    
            const user = await Users.findById(senderId);
    
            if (receiver) {
                io.to(receiver.socketId).to(sender.socketId).emit('getMessage', {
                    senderId,
                    message,
                    conversationId,
                    receiverId,
                    user: { id: user._id, fullName: user.fullName, email: user.email }
                });
            } else {
                io.to(sender.socketId).emit('getMessage', {
                    senderId,
                    message,
                    conversationId,
                    receiverId,
                    user: { id: user._id, fullName: user.fullName, email: user.email }
                });
            }
        } catch (error) {
            console.log('Error sending message:', error);
        }
    });
    

    socket.on('disconnect', async() => {
        // Log the disconnection
        console.log('A user disconnected:', socket.id);
    
        // Remove the user from the users array
        users = users.filter(user => user.socketId !== socket.id);
        io.emit('getUsers', users);
    
        // Remove the user from the onlineUsers object
        for (const userId in onlineUsers) {
            if (onlineUsers[userId] === socket.id) {
                delete onlineUsers[userId];
                await Users.findByIdAndUpdate(userId, { online: false });
                io.emit('updateUserStatus', { userId, status: 'offline' });
                break;
            }
        }
    });
     
});




// <<<-----------------------socket.io code ends------------------------------->>>>






// Routes
app.get('/', (req, res) => {
    res.send('Welcome');
})
 



// <-------------------registration code ----------------------->
app.post('/api/register', async (req, res, next) => {
    try {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            res.status(400).send('Please fill all required fields');
        } else {
            const isAlreadyExist = await Users.findOne({ email });
            if (isAlreadyExist) {
                res.status(400).send('User already exists');
            } else {
               
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new Users({ fullName, email, password: hashedPassword });
        await newUser.save();

        // Automatically log in the user
        const payload = {
            userId: newUser._id,
            email: newUser.email,
        };
        const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';
        const token = jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: 84600 });

        await Users.updateOne({ _id: newUser._id }, { $set: { token } });

        return res.status(200).json({
            message: 'User registered and logged in successfully',
            user: { id: newUser._id, email: newUser.email, fullName: newUser.fullName },
            token: token
        });
            }
        }

    } catch (error) {
        console.log(error, 'Error')
    }
})




// <-------------------login code------------------------------->
app.post('/api/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        console.log(password);

        if (!email || !password) {
            res.status(400).send('Please fill all required fields');
        } else {
            const user = await Users.findOne({ email });
            console.log(user)
            if (!user) {
                res.status(400).send('User email or password is incorrect');
            } else {
                const validateUser = await bcrypt.compare(password, user.password);
                if (!validateUser) {
                    res.status(400).send('Password is incorrect');
                } else {
                    const payload = {
                        userId: user._id,
                        email: user.email
                    }
                    const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';

                    jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: 84600 }, async (err, token) => {
                        await Users.updateOne({ _id: user._id }, {
                            $set: { token }
                        })
                        user.save();
                        return res.status(200).json({ user: { id: user._id, email: user.email, fullName: user.fullName }, token: token })
                    })
                }
            }
        }

    } catch (error) {
        console.log(error, 'Error')
    }
})





// <------------------adding conversation to database----------------------->
app.post('/api/conversation', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        const newCoversation = new Conversations({ members: [senderId, receiverId] });
        await newCoversation.save();
        res.status(200).send('Conversation created successfully');
    } catch (error) {
        console.log(error, 'Error')
    }
})

// Check or Create Conversation Endpoint
app.post('/api/conversations/check', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        let conversation = await Conversations.findOne({ members: { $all: [senderId, receiverId] } });

        if (!conversation) {
            conversation = new Conversations({ members: [senderId, receiverId] });
            await conversation.save();
        }

        res.status(200).json({ conversationId: conversation._id });
    } catch (error) {
        console.error('Error checking or creating conversation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// <-----------------fetchinh conversations from database ------------------------------->
app.get('/api/conversations/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const conversations = await Conversations.find({ members: { $in: [userId] } });
        const conversationUserData = Promise.all(conversations.map(async (conversation) => {
            const receiverId = conversation.members.find((member) => member !== userId);
            const user = await Users.findById(receiverId);
            return { user: { receiverId: user._id, email: user.email, fullName: user.fullName }, conversationId: conversation._id }
        }))
        res.status(200).json(await conversationUserData);
    } catch (error) {
        console.log(error, 'Error')
    }
})





// <------------------------adding every message to database --------------------------->
app.post('/api/message', async (req, res) => {
    try {
        const { conversationId, senderId, message, receiverId = '' } = req.body;
        if (!senderId || !message) return res.status(400).send('Please fill all required fields');
        
        let convId = conversationId;
        
        if (conversationId === 'new' && receiverId) {
            const existingConversation = await Conversations.findOne({ members: { $all: [senderId, receiverId] } });
            
            if (existingConversation) {
                convId = existingConversation._id;
            } else {
                const newConversation = new Conversations({ members: [senderId, receiverId] });
                await newConversation.save();
                convId = newConversation._id;
            }
        } else if (!conversationId && !receiverId) {
            return res.status(400).send('Please fill all required fields');
        }
        
        const newMessage = new Messages({ conversationId: convId, senderId, message });
        await newMessage.save();
        
        res.status(200).send({ message: 'Message sent successfully', conversationId: convId });
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).send('Internal Server Error');
    }
});





// <------------------------getting all messages from database -------------------------->
app.get('/api/message/:conversationId', async (req, res) => {
    try {
      const checkMessages = async (conversationId) => {
        const messages = await Messages.find({ conversationId });
        const messageUserData = await Promise.all(messages.map(async (message) => {
          const user = await Users.findById(message.senderId);
          return { user: { id: user._id, email: user.email, fullName: user.fullName }, message: message.message };
        }));
        res.status(200).json(messageUserData);
      };
  
      const conversationId = req.params.conversationId;
  
      if (conversationId === 'new') {
        const { senderId, receiverId } = req.query;
        if (!senderId || !receiverId) {
          return res.status(400).json({ error: 'Missing senderId or receiverId' });
        }
  
        const checkConversation = await Conversations.findOne({ members: { $all: [senderId, receiverId] } });
        if (checkConversation) {
          await checkMessages(checkConversation._id);
        } else {
          return res.status(200).json([]);
        }
      } else {
        await checkMessages(conversationId);
      }
    } catch (error) {
      console.log('Error', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  




// <----------------------fetching all users from database -------------------------->

app.get('/api/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const users = await Users.find({ _id: { $ne: userId } });
        const usersData = Promise.all(users.map(async (user) => {
            return { user: { email: user.email, fullName: user.fullName, receiverId: user._id } }
        }))
        res.status(200).json(await usersData);
    } catch (error) {
        console.log('Error', error)
    }
})



export { app }