import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/login.css';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  // Efecto para animar el formulario al cargar
  useEffect(() => {
    const form = document.querySelector('.login-form');
    if (form) {
      form.style.opacity = '0';
      form.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        form.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        form.style.opacity = '1';
        form.style.transform = 'translateY(0)';
      }, 100);
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    const requestBody = new FormData();
    let loginType;

    if (isNumeric(username)) {
      loginType = 'cedulaEmpleado';
      requestBody.append('username', username);
    } else {
      loginType = 'username';
      requestBody.append('username', username);
    }
    requestBody.append('password', password);

    try {
      const response = await fetch('/api/security/login', {
        method: 'POST',
        body: requestBody,
      });

      if (!response.ok) {
        throw new Error('Usuario o contraseña incorrectos');
      }

      const data = await response.json();
      const { access_token, expires_in, refresh_token } = data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('expires_in', expires_in);
      localStorage.setItem('refresh_token', refresh_token);

      if (loginType === 'cedulaEmpleado') {
        localStorage.setItem('cedulaEmpleado', username);
      } else {
        localStorage.setItem('username', username);
      }

      const userInfo = parseJwt(access_token);
      localStorage.setItem('userEmail', userInfo.email);
      localStorage.setItem('userId', userInfo.id);
      // Guardar el nombre de usuario para mostrarlo después del login
      localStorage.setItem('displayName', username);

      const roles = await getRoles(access_token, loginType, username);

      const userData = {
        username: username,
        roles: roles,
        email: userInfo.email,
        id: userInfo.id,
      };

      // Animación de éxito antes de redirigir
      const form = document.querySelector('.login-form');
      if (form) {
        form.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
        form.style.transform = 'scale(1.03)';
        setTimeout(() => {
          form.style.opacity = '0';
          form.style.transform = 'scale(0.95)';
          
          // Llamar a onLogin con los datos del usuario
          setTimeout(() => {
            onLogin(userData);
            // Redirigir al usuario a la página principal o dashboard
            navigate('/');
          }, 300);
        }, 200);
      } else {
        onLogin(userData);
        navigate('/');
      }
    } catch (error) {
      setError(error.message);
      // Animación de error
      const inputFields = document.querySelectorAll('.input-field');
      inputFields.forEach(field => {
        field.style.transition = 'transform 0.1s ease';
        field.style.transform = 'translateX(10px)';
        setTimeout(() => {
          field.style.transform = 'translateX(-10px)';
          setTimeout(() => {
            field.style.transform = 'translateX(0)';
          }, 100);
        }, 100);
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isNumeric = (value) => {
    return /^\d+$/.test(value);
  };

  const parseJwt = (token) => {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  };

  const getRoles = async (token, loginType, username) => {
    try {
      const response = await fetch('/api/security/roles', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al obtener los roles');
      }

      const roles = await response.json();
      console.log('Roles del usuario:', roles);

      return roles;
    } catch (error) {
      console.error('Error al obtener los roles:', error);
      setError('Error al obtener los roles del usuario');
      return [];
    }
  };

  return (
    <div className="login-container">
      <div className="login-form compact-form">
        <h2 className="login-title">Iniciar sesión</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username" className="input-label">Usuario o Cédula</label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="input-field"
              placeholder="Ingrese su usuario o cédula"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label htmlFor="password" className="input-label">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="input-field"
              placeholder="Ingrese su contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button
            type="submit"
            className="submit-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="spinner" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Iniciando...
              </>
            ) : 'Iniciar sesión'}
          </button>
          <div className="register-link">
            <p><a href="/registrar">Registrarse</a> | <a href="/OlvidarContraseña">Recuperar contraseña</a></p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;