from flask import Flask, request, jsonify
import threading
import time

app = Flask(__name__)
crack_results = {}

def crack_password_simulator(hash_value):
    # Simulate cracking time (e.g., 30 seconds)
    time.sleep(30)
    crack_results[hash_value] = 'cracked'

@app.route('/api/start', methods=['POST'])
def start_cracking():
    data = request.json
    hash_value = data['hash']
    if hash_value not in crack_results or crack_results[hash_value] != 'cracked':
        crack_results[hash_value] = 'pending'
        # Start the simulated cracking in a background thread
        threading.Thread(target=crack_password_simulator, args=(hash_value,)).start()
    return jsonify({'status': 'started'})

@app.route('/api/status')
def check_status():
    hash_value = request.args.get('hash')
    status = crack_results.get(hash_value, 'unknown')
    return jsonify({'status': status})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)