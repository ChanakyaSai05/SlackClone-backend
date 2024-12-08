export const handleAuthError = (error, res) => {
  console.error('Authentication error:', error);
  res.status(500).json({ 
    message: 'An error occurred during authentication. Please try again.' 
  });
};

export const handleDatabaseError = (error, res) => {
  console.error('Database error:', error);
  res.status(500).json({ 
    message: 'A database error occurred. Please try again.' 
  });
};

export const handleValidationError = (error, res) => {
  console.error('Validation error:', error);
  res.status(400).json({ 
    message: error.message || 'Validation failed. Please check your input.' 
  });
};