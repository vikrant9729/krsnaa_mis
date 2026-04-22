import uvicorn
import socket

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

if __name__ == "__main__":
    ip = get_ip()
    print("\n" + "="*50)
    print(f"KRSNAA MIS BACKEND SERVER")
    print(f"Local Access: http://localhost:8000")
    print(f"Network Access: http://{ip}:8000")
    print("="*50 + "\n")
    
    print("Starting server on 0.0.0.0:8000...")
    print("NOTE: If you still cannot connect from another PC, check Windows Firewall for port 8000.")
    
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
