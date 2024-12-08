export const validateRegistration = (name, email, password) => {
  if (!name || !email || !password) {
    return 'All fields are required';
  }
  
  if (name.length < 2) {
    return 'Name must be at least 2 characters long';
  }
  
  if (!isValidEmail(email)) {
    return 'Invalid email format';
  }
  
  if (password.length < 6) {
    return 'Password must be at least 6 characters long';
  }
  
  return null;
};

export const validateLogin = (email, password) => {
  if (!email || !password) {
    return 'Email and password are required';
  }
  
  if (!isValidEmail(email)) {
    return 'Invalid email format';
  }
  
  return null;
};

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};