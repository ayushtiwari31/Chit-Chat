import { useEffect, useRef, useState } from 'react'
import Img1 from '../../assets/img7.png'
import profile from '../../assets/profile.png'
import Input from '../../components/Input'
import { io } from 'socket.io-client'
import React from 'react';

const Dashboard = () => {
	const [user, setUser] = useState(() => {
        try {
          const userDetail = JSON.parse(localStorage.getItem('user:detail'));
          return userDetail || {}; // Fallback to an empty object if parsing fails or data is null
        } catch (error) {
          console.error('Error parsing user details from localStorage:', error);
          return {}; // Return an empty object as a fallback
        }
      });
	const [conversations, setConversations] = useState([])
	
  const [messages, setMessages] = useState({ messages: [], receiver: null, conversationId: null });

	const [message, setMessage] = useState('')
	const [users, setUsers] = useState([])
	const [socket, setSocket] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState({});
	const messageRef = useRef(null)
  const [userConversations, setUserConversations] = useState({});

	useEffect(() => {
		const socketInstance = io('http://chit-chat-5-wnwg.onrender.com:8080');
        setSocket(socketInstance);
	}, [user])



    useEffect(() => {
      socket?.emit('addUser', user?.id);
      socket?.on('getUsers', users => {
        console.log('activeUsers :>> ', users);
      });
      socket?.on('getMessage', data => {
        setMessages(prev => ({
          ...prev,
          messages: [...prev.messages, { user: data.user, message: data.message }]
        }));
      });
    }, [socket]);
    

  useEffect(() => {
    const loggedInUser = JSON.parse(localStorage.getItem('user:detail'));
    
    const fetchConversations = async () => {
      const res = await fetch(`https://chit-chat-5-wnwg.onrender.com/api/conversations/${loggedInUser?.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const resData = await res.json();
      const userConversations = {};
  
      resData.forEach(conversation => {
        conversation.members.forEach(memberId => {
          if (memberId !== loggedInUser.id) {
            userConversations[memberId] = conversation._id;
          }
        });
      });
  
      setConversations(resData);
      setUserConversations(userConversations);
    };
    
    fetchConversations();
  }, []);
  
  

	

    useEffect(() => {
        messageRef?.current?.scrollIntoView({ behavior: 'smooth' });
      }, [messages?.messages]);
    
    //fetchinh all existing users
    useEffect(() => {
        const fetchUsers = async () => {
          try {
            const res = await fetch(`https://chit-chat-5-wnwg.onrender.com/api/users/${user?.id}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              }
            });
            const resData = await res.json();
      
            const updatedUsers = resData.map(userItem => ({
              ...userItem,
              conversationId: userConversations[userItem.userId] || 'new', // Add conversation ID or 'new'
            }));
      
            setUsers(updatedUsers);
            const initialOnlineUsers = {};
            resData.forEach(userItem => {
              if (userItem.online) {
                initialOnlineUsers[userItem._id] = 'online';
              }
            });

            
            setOnlineUsers(initialOnlineUsers);



             // Emit user online event
        socket.emit('userOnline', user.id);

        // Listen for user status updates
        socket.on('updateUserStatus', ({ userId, status }) => {
            setOnlineUsers((prev) => ({ ...prev, [userId]: status }));
        });

        
          } catch (error) {
            console.error('Error fetching users:', error);
          }
        };
        
        fetchUsers();

        // Clean up socket connection on component unmount
        return () => {
          socket.disconnect();
      };

      }, [user]);
      

     //fetching all messages of conversation
      const fetchMessages = async (conversationId, receiver) => {
        try {
          const res = await fetch(`https://chit-chat-5-wnwg.onrender.com/api/message/${conversationId}?senderId=${user?.id}&receiverId=${receiver?.receiverId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          const resData = await res.json();
          setMessages({ messages: resData, receiver, conversationId: conversationId  });
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      };
      
      


    //sending messages
      const sendMessage = async (e) => {
        e.preventDefault();
        const senderId = user?.id;
        const receiverId = messages?.receiver?.receiverId;
        let conversationId = messages?.conversationId;
        const messageContent = message;
    
        // Clear the message input field
        setMessage('');
    
        try {
            // Check if the conversation ID is 'new'
            if (conversationId === 'new') {
                const response = await fetch(`https://chit-chat-5-wnwg.onrender.com/api/conversations/check`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        senderId,
                        receiverId
                    })
                });
    
                const responseData = await response.json();
                conversationId = responseData.conversationId;
    
                // Update the state with the correct conversation ID
                setMessages((prevMessages) => ({
                    ...prevMessages,
                    conversationId: conversationId
                }));
            }
    
            // Send the message using socket
            socket?.emit('sendMessage', {
                senderId,
                receiverId,
                message: messageContent,
                conversationId
            });
    
            // Save the message to the database
            await fetch(`https://chit-chat-5-wnwg.onrender.com/api/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    conversationId,
                    senderId,
                    message: messageContent,
                    receiverId
                })
            });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };
    









      return (
        <div className='flex flex-col lg:flex-row w-full h-screen'>


          {/* ---------------Sidebar------------------- */}
          <div className='lg:w-1/4 w-full h-screen bg-secondary overflow-scroll'>
            <div className='flex items-center my-8 px-4 lg:px-14'>
              <div>
                <img src={profile} width={85} height={85} className='border border-primary p-[2px] rounded-full transform transition-transform duration-300 ease-in-out hover:scale-110' />
              </div>
              <div className='ml-8'>
                <h2 className='text-2xl'>{user?.fullName}</h2>
                <p className='text-lg font-light'>{user?.email}</p>
                <p className='text-lg font-light'>My Account</p>
              </div>
            </div>
            <hr />
          </div>
    



          {/*middle section ----------------- messages section */}
          <div className='lg:w-1/2 w-full h-screen bg-orange-50  flex flex-col items-center overflow-scroll '>
            {messages?.receiver?.fullName && (
              <div className='w-11/12 lg:w-3/4 bg-secondary h-[80px] my-4 lg:my-14 rounded-full flex items-center px-6 lg:px-14 py-2'>
                <div className='cursor-pointer'>
                  <img src={Img1} width={60} height={60} className="rounded-full" />
                </div>
                <div className='ml-6 mr-auto'>
                  <h3 className='text-lg'>{messages?.receiver?.fullName}</h3>
                  <p className='text-sm font-light text-gray-600'>{messages?.receiver?.email}</p>

                </div>
                <div className='cursor-pointer'>
                <p className='text-sm font-light text-gray-600'>{onlineUsers[user?.id] === 'online' ? 'Online' : 'Offline'}</p>
                </div>
              </div>
            )}
    
            {messages?.messages?.length > 0 ? (
              messages.messages.map(({ message, user: { id } = {} }, index) => (
                <React.Fragment key={index}>
                  <div
                    className={`max-w-[75%] lg:max-w-[40%] rounded-b-xl p-3 mb-10  backdrop-blur-md border border-[#ffffff33]
                       ${
                      id === user?.id
                        ? 'bg-primary text-white rounded-tl-xl ml-auto mr-10'
                        : 'bg-secondary rounded-tr-xl ml-10 mr-auto'
                    }`}

                    style={{
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                     
                    }}
                  >
                    {message}
                  </div>
                  <div ref={messageRef}></div>
                </React.Fragment>
              ))
            ) : (
              <div className='text-center text-lg font-semibold mt-24'>
                No Messages or No Conversation Selected
              </div>
            )}
    


          {/* ----------message typing--------------  */}

            {messages?.receiver?.fullName && (
              <div className='p-16 lg:p-5 w-full flex items-center'>
                 <Input 
      placeholder='Type a message...'
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      className='w-full ml-20 mt-200' 
      inputClassName='p-4 border-0   shadow-md rounded-full bg-light focus:ring-0 focus:border-0 outline-none' 
    />
                {/* <Input placeholder='Type a message...' value={message} onChange={(e) => setMessage(e.target.value)} className='w-[100%]' inputClassName='p-4 border-0 shadow-md rounded-full bg-light focus:ring-0 focus:border-0 outline-none' /> */}
                <div className={`ml-4 p-2 cursor-pointer bg-light rounded-full ${!message && 'pointer-events-none'}`} onClick={(e) => sendMessage(e)}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-send" width="30" height="30" viewBox="0 0 24 24" strokeWidth="1.5" stroke="#2c3e50" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                    <path d="M21 3l-6.5 18a0.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a0.55 .55 0 0 1 0 -1l18 -6.5" />
                  </svg>
                </div>
                <div className={`ml-4 p-2 cursor-pointer bg-light rounded-full ${!message && 'pointer-events-none'}`}>
                 
                </div>
              </div>
            )}
          </div>
    



          {/* right section */}
          {/* People List */}
          <div className='lg:w-1/4 w-full h-screen bg-light px-4 lg:px-8 py-8 lg:py-16 overflow-scroll'>
            <div className='text-primary text-lg'>People</div>
            <div>
              
              {users.length > 0 ? (
  users.map(({ userId, user, conversationId }) => (
    <div key={userId} className='flex items-center py-4 lg:py-8 border-b border-b-gray-300'>
      <div className='cursor-pointer flex items-center' onClick={() => fetchMessages(user.conversationId || 'new', user)}>
        <div>
          <img src={Img1} className="w-[60px] h-[60px] rounded-full p-[2px] border border-primary transform transition-transform duration-300 ease-in-out hover:scale-110" />
        </div>
        <div className='ml-6'>
          <h3 className='text-lg font-semibold'>{user?.fullName}</h3>
          <p className='text-sm font-light text-gray-600'>{user?.email}</p>
          <p className='text-sm font-light text-gray-600'>{onlineUsers[user?.id] === 'online' ? 'Online' : 'Offline'}</p>
        </div>
      </div>
    </div>
  ))
) : (
  <div className='text-center text-lg font-semibold mt-24'>No Users</div>
)}

            </div>
          </div>
        </div>
      );
    };
  

export default Dashboard