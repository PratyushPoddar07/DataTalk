import sys
import certifi
from pymongo import MongoClient
import ssl

def test_connection(url):
    print(f"Testing connection to: {url}")
    
    configs = [
        {
            "name": "Standard (Implicit TLS)",
            "options": {}
        },
        {
            "name": "Certifi (Explicit tlsCAFile)",
            "options": {"tlsCAFile": certifi.where()}
        },
        {
            "name": "Certifi + Explicit tls=True",
            "options": {"tls": True, "tlsCAFile": certifi.where()}
        },
        {
            "name": "Insecure (tlsAllowInvalidCertificates=True)",
            "options": {"tls": True, "tlsAllowInvalidCertificates": True}
        },
        {
            "name": "TLS 1.2 Override",
            "options": {"tls": True, "ssl_version": ssl.PROTOCOL_TLSv1_2, "tlsCAFile": certifi.where()}
        }
    ]
    
    for config in configs:
        print(f"\n--- Trying configuration: {config['name']} ---")
        try:
            client = MongoClient(url, serverSelectionTimeoutMS=5000, **config['options'])
            # The ping command is what triggers the handshake
            client.admin.command('ping')
            print(f"✅ SUCCESS: {config['name']} worked!")
            return config['options']
        except Exception as e:
            print(f"❌ FAILED: {config['name']}")
            print(f"   Error: {e}")
            
    print("\n[!] All configurations failed. Please check your Atlas IP Whitelist and cluster status.")
    return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_mongo_connection.py \"<mongodb_connection_string>\"")
        sys.exit(1)
    
    connection_string = sys.argv[1]
    test_connection(connection_string)
