import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const ControlDashboard = () => {
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isThrottled, setIsThrottled] = useState(false);  // New: Gate for directional controls
  const [status, setStatus] = useState('Disconnected');
  const [espIP, setEspIP] = useState('192.168.0.102');
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const [lastCommand, setLastCommand] = useState('Ready to fly!');
  const [motorRPM, setMotorRPM] = useState({
    frontLeft: 1000, frontRight: 1000, rearLeft: 1000, rearRight: 1000  });
const [speed,setSpeed]=useState([]);
  const connect = () => {
    console.log("connect clicked ");
    const socket = new WebSocket(`ws://${espIP}:80/ws`);
    wsRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      setIsThrottled(false);  // Reset on connect—throttle required
      setStatus('Connected! Throttle up to enable controls.');
      console.log('WebSocket connected');
      // Auto-reset to balanced hover
      resetMotors();
    };

    socket.onmessage = (event) => {
      try{
         let message=JSON.parse(event.data);
         setStatus(event.data);
         setSpeed(message.values);
      console.log('Received:', message.values);
      for(let i=0;i<message.values.length;i++){
      console.log(message.values[i],"my speeds")
      }
      }catch(e){
console.log(e)
      }
    
      
       

      
      
    };

    socket.onclose = () => {
      setIsConnected(false);
      setIsThrottled(false);  // Reset on disconnect
      setStatus('Disconnected');
      console.log('WebSocket closed');
    };

    socket.onerror = (error) => {
      setStatus('Connection error');
      console.error('WebSocket error:', error);
    };

    setWs(socket);
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  // Gas pedal throttle handler (hold for continuous ramp) - Enables controls on first up
  const handleThrottle = useCallback((direction) => {
    console.log('🔥 handleThrottle called with:', direction);
    
    if (!ws || !isConnected) {
      console.log('❌ Not connected, skipping');
      setStatus('Not connected—connect first!');
      return;
    }

    console.log('✅ Connected, starting interval');

    // Clear old interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const step = 50;
    const interval = setInterval(() => {
      console.log('Interval callback firing!');
      console.log('About to send:', direction);
      ws.send(direction);
      console.log('Sent!');
      setMotorRPM(prev => {
        let newRPM = { ...prev };
        Object.keys(newRPM).forEach(key => {
          if (direction === 'throttleUp') {
            newRPM[key] = Math.min(2000, prev[key] + step);
          } else {
            newRPM[key] = Math.max(500, prev[key] - step);
          }
        });
        return newRPM;
      });
    }, 100);

    intervalRef.current = interval;
    console.log('Interval created, ID:', interval);

    // Enable directional controls on first throttleUp (optional: toggle off on down)
    if (direction === 'throttleUp' && !isThrottled) {
      setIsThrottled(true);
      setStatus('Throttled! Directional controls enabled.');
      setLastCommand('Throttled UP - Controls unlocked!');
    } else if (direction === 'throttleDown') {
      setLastCommand('Throttled DOWN...');
    } else {
      setLastCommand(`Throttling ${direction === 'throttleUp' ? 'UP' : 'DOWN'}... (release to hold)`);
    }
  }, [ws, isConnected, isThrottled]);

  // Stop throttle on release
  const stopThrottle = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    console.log('Interval stopped');
    setLastCommand('Throttle held—steady!');
  }, []);

  // Send other commands (pitch/roll/yaw) + sim
  const sendCommand = (command) => {
    console.log("send command clicked");
    if (ws && isConnected) {
      ws.send(command);
      console.log('Sent:', command);

      const action = command.toLowerCase();
      console.log(`Command sent: ${action}`);
      setLastCommand(`Sent: ${command.replace(/([A-Z])/g, ' $1').trim()}`);

      const delta = 0;
      setMotorRPM(prev => {
        let newRPM = { ...prev };

        switch (action) {
          case 'pitchup':
            newRPM.frontLeft = Math.min(2000, prev.frontLeft + delta);
            newRPM.frontRight = Math.min(2000, prev.frontRight + delta);
            newRPM.rearLeft = Math.max(500, prev.rearLeft - delta);
            newRPM.rearRight = Math.max(500, prev.rearRight - delta);
            break;
          case 'pitchdown':
            newRPM.frontLeft = Math.max(500, prev.frontLeft - delta);
            newRPM.frontRight = Math.max(500, prev.frontRight - delta);
            newRPM.rearLeft = Math.min(2000, prev.rearLeft + delta);
            newRPM.rearRight = Math.min(2000, prev.rearRight + delta);
            break;
          case 'rollleft':
            newRPM.frontLeft = Math.min(2000, prev.frontLeft + delta);
            newRPM.rearLeft = Math.min(2000, prev.rearLeft + delta);
            newRPM.frontRight = Math.max(500, prev.frontRight - delta);
            newRPM.rearRight = Math.max(500, prev.rearRight - delta);
            break;
          case 'rollright':
            newRPM.frontLeft = Math.max(500, prev.frontLeft - delta);
            newRPM.rearLeft = Math.max(500, prev.rearLeft - delta);
            newRPM.frontRight = Math.min(2000, prev.frontRight + delta);
            newRPM.rearRight = Math.min(2000, prev.rearRight + delta);
            break;
          case 'yawleft':
            newRPM.frontLeft = Math.min(2000, prev.frontLeft + delta);
            newRPM.rearLeft = Math.min(2000, prev.rearLeft + delta);
            newRPM.frontRight = Math.max(500, prev.frontRight - delta);
            newRPM.rearRight = Math.max(500, prev.rearRight - delta);
            break;
          case 'yawright':
            newRPM.frontLeft = Math.max(500, prev.frontLeft - delta);
            newRPM.rearLeft = Math.max(500, prev.rearLeft - delta);
            newRPM.frontRight = Math.min(2000, prev.frontRight + delta);
            newRPM.rearRight = Math.min(2000, prev.rearRight + delta);
            break;
          default:
            break;
        }
        return newRPM;
      });
    } else {
      setStatus('Not connected—connect first!');
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Keyboard for gas pedal (Space=Up, Shift=Down)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        console.log("throtle pressed");
        handleThrottle('throttleUp');
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        handleThrottle('throttleDown');
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        stopThrottle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleThrottle, stopThrottle]);

  const resetMotors = () => {
    setMotorRPM({ frontLeft: 1000, frontRight: 1000, rearLeft: 1000, rearRight: 1000 });
    setLastCommand('Motors reset to hover!');
  };

  // Calcs
  const avgFront = (motorRPM.frontLeft + motorRPM.frontRight) / 2;
  const avgRear = (motorRPM.rearLeft + motorRPM.rearRight) / 2;
  const pitchBias = ((avgFront - avgRear) / 1500) * 100;
  const tiltColor = pitchBias > 0 ? '#4facfe' : pitchBias < -10 ? '#ff6b6b' : '#00ff00';
  const avgRPM = Object.values(motorRPM).reduce((a, b) => a + b, 0) / 4;
  const throttlePercent = ((avgRPM - 500) / 1500) * 100;

  return (
    <div className="app">
      <div className="dashboard">
        <h1>Drone Control Dashboard</h1>
        
        <div className="connection-section">
          <input
            type="text"
            value={espIP}
            onChange={(e) => setEspIP(e.target.value)}
            placeholder="ESP32 IP (e.g., 192.168.0.100)"
          />
          <button onClick={connect} disabled={isConnected}>Connect</button>
          <button onClick={disconnect} disabled={!isConnected}>Disconnect</button>
          <div>Status: {status}</div>
        </div>
        
        <div className="status">{lastCommand}</div>
        
        <button className="reset-btn" onClick={resetMotors}>
          Reset to Hover (1000 RPM)
        </button>
        
        <div className="tilt-indicator">
          <h4>Pitch Tilt (Front vs. Rear RPM Bias)</h4>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: `${Math.abs(pitchBias)}%`, 
                backgroundColor: tiltColor,
                left: pitchBias > 0 ? '50%' : '0%'
              }}
            ></div>
            <span className="bias-label">{pitchBias > 0 ? `+${pitchBias.toFixed(0)}% Up` : pitchBias < 0 ? `${pitchBias.toFixed(0)}% Down` : 'Balanced'}</span>
          </div>
        </div>

        <div className="throttle-bar">
          <h4>Throttle Level: {Math.round(avgRPM)} μs ({throttlePercent.toFixed(0)}%)</h4>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${throttlePercent}%`, backgroundColor: '#4facfe' }}
            ></div>
          </div>
          <p className="throttle-hint">Hold Space (Up) / Shift (Down) or mouse buttons for gas pedal feel!</p>
        </div>
        
        <div className="motor-display">
          <h3>Motor RPM</h3>
          <div className="motors">
     {speed.map((item, index) => (
          <div className="motor" key={index}>{item}</div>
        ))}
           {/*<div className="motor">FL: {speed.frontLeft} RPM</div>
            <div className="motor">FR: {speed.frontRight} RPM</div>
            <div className="motor">RL: {speed.rearLeft} RPM</div>
            <div className="motor">RR: {speed.rearRight} RPM</div> */}
             
          </div>
        </div>
        
        <div className="control-group">
          <div className="group-label">
            Pitch (Front/Back Tilt) 
            <span className="tooltip">Front  Rear = Nose Up</span>
          </div>
          <div className="controls">
            <button 
              onClick={() => sendCommand('PitchUp')} 
              title="Front motors: +RPM, Rear: -RPM → Nose Up"
              disabled={!isConnected || !isThrottled}  // Gated by throttle
            >
              <span className="icon">⬆️</span> Pitch Up
            </button>
            <button 
              onClick={() => sendCommand('PitchDown')} 
              title="Front motors: -RPM, Rear: +RPM → Nose Down"
             
            >
              <span className="icon">⬇️</span> Pitch Down
            </button>
          </div>
        </div>
        
        <div className="control-group">
          <div className="group-label">Roll (Left/Right Bank)</div>
          <div className="controls">
            <button 
              onClick={() => sendCommand('RollLeft')} 
              title="Left motors: +RPM, Right: -RPM"
              
            >
              <span className="icon">↩️</span> Roll Left
            </button>
            <button 
              onClick={() => sendCommand('RollRight')} 
              title="Right motors: +RPM, Left: -RPM"
              
            >
              <span className="icon">↪️</span> Roll Right
            </button>
          </div>
        </div>
        
        <div className="control-group">
          <div className="group-label">Yaw (Left/Right Turn)</div>
          <div className="controls">
            <button 
              onClick={() => sendCommand('YawLeft')} 
              title="Left: +RPM, Right: -RPM (CCW)"
             
            >
              <span className="icon">⬅️</span> Yaw Left
            </button>
            <button 
              onClick={() => sendCommand('YawRight')} 
              title="Right: +RPM, Left: -RPM (CW)"
              
            >
              <span className="icon">➡️</span> Yaw Right
            </button>
          </div>
        </div>
        
        <div className="control-group throttle-group">
          <div className="group-label">Throttle (Overall RPM) - Gas Pedal Mode</div>
          <div className="controls">
            <button 
              onMouseDown={() => handleThrottle('throttleUp')}
              onMouseUp={stopThrottle}
              onMouseLeave={stopThrottle}
              onTouchStart={() => handleThrottle('throttleUp')}
              onTouchEnd={stopThrottle}
              onTouchCancel={stopThrottle}
              title="Hold for continuous throttle up"
             
            >
              <span className="icon">🔼</span> Gas Up (Hold)
            </button>
            <button 
              onMouseDown={() => handleThrottle('throttleDown')}
              onMouseUp={stopThrottle}
              onMouseLeave={stopThrottle}
              onTouchStart={() => handleThrottle('throttleDown')}
              onTouchEnd={stopThrottle}
              onTouchCancel={stopThrottle}
              title="Hold for continuous throttle down"
            
            >
              <span className="icon">🔽</span> Brake Down (Hold)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return <ControlDashboard />;
}

export default App;