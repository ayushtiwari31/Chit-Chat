
import { useState } from "react";
import Button from "../../components/Button";
import Input from "../../components/Input";
import { useNavigate } from 'react-router-dom';
import axios from "axios";

const Form = ({ isSignInPage = true }) => {
  const [data, setData] = useState({
    ...(isSignInPage ? {} : { fullName: '' }),
    email: '',
    password: ''
  });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = `http://localhost:8000/api/${isSignInPage ? 'login' : 'register'}`;

    try {
      const response = await axios.post(url, data);
      const resData = response.data;

      if (resData.token) {
        localStorage.setItem('user:token', resData.token);
        localStorage.setItem('user:detail', JSON.stringify(resData.user));
        navigate('/');  // Redirect to home or dashboard
      }
    } catch (error) {
      if (error.response) {
        // Server responded with a status other than 200 range
        console.error('Error response:', error.response.data);
        alert(`Error: ${error.response.data}`);
      } else if (error.request) {
        // No response received from the server
        console.error('Error request:', error.request);
        alert('Error: No response received from the server');
      } else {
        // Something else happened while setting up the request
        console.error('Error message:', error.message);
        alert(`Error: ${error.message}`);
      }
    }
  };

  return (
    <div className="bg-light h-screen flex items-center justify-center">
      <div className="bg-white w-[600px] h-[800px] shadow-lg rounded-lg flex flex-col justify-center items-center">
        <div className="text-4xl font-extrabold">Welcome {isSignInPage ? 'Back' : '!'}</div>
        <div className="text-xl font-light mb-14">{isSignInPage ? 'Sign in to explore' : 'Sign up to get started'}</div>
        <form className="flex flex-col items-center w-full" onSubmit={handleSubmit}>
          {!isSignInPage && (
            <Input
              label="Full name"
              name="fullName"
              placeholder="Enter your full name"
              className="mb-6 w-[75%]"
              value={data.fullName}
              onChange={(e) => setData({ ...data, fullName: e.target.value })}
            />
          )}
          <Input
            label="Email address"
            type="email"
            name="email"
            placeholder="Enter your email"
            className="mb-6 w-[75%]"
            value={data.email}
            onChange={(e) => setData({ ...data, email: e.target.value })}
          />
          <Input
            label="Password"
            type="password"
            name="password"
            placeholder="Enter your password"
            className="mb-14 w-[75%]"
            value={data.password}
            onChange={(e) => setData({ ...data, password: e.target.value })}
          />
          <Button label={isSignInPage ? 'Sign in' : 'Sign up'} type="submit" className="w-[75%] mb-2" />
        </form>
        <div>
          {isSignInPage ? "Don't have an account?" : "Already have an account?"}{' '}
          <span
            className="text-primary cursor-pointer underline"
            onClick={() => navigate(`/users/${isSignInPage ? 'sign_up' : 'sign_in'}`)}
          >
            {isSignInPage ? 'Sign up' : 'Sign in'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Form;
