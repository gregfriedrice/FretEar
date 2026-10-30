#!/usr/bin/env python3
"""
FretEar - Guitar Phrase By Ear Looper
Standalone Python (Flask) Backend for local desktop execution.
Supports yt-dlp audio extraction, local caching, and audio streaming.
"""

import os
import sys
import json
import subprocess
import webbrowser
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, render_template_string

app = Flask(__name__, static_folder='dist', static_url_path='')

BASE_DIR = Path(__file__).resolve().parent
CACHE_DIR = BASE_DIR / 'cache'
CACHE_DIR.mkdir(exist_ok=True)
INDEX_FILE = CACHE_DIR / 'tracks_index.json'

def get_track_index():
    if INDEX_FILE.exists():
        try:
            with open(INDEX_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_track_index(index):
    try:
        with open(INDEX_FILE, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2)
    except Exception as e:
        print(f"Error saving index: {e}", file=sys.stderr)

import re

def extract_video_id(url):
    m = re.search(r'(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})', url)
    return m.group(1) if m else None

@app.route('/api/cached-tracks', methods=['GET'])
def list_cached_tracks():
    index = get_track_index()
    tracks = []
    for track_id, item in index.items():
        track = dict(item)
        track['audioUrl'] = f'/api/audio/{track_id}'
        tracks.append(track)
    return jsonify({'success': True, 'tracks': tracks})

@app.route('/api/youtube', methods=['POST'])
def process_youtube():
    data = request.get_json() or {}
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'success': False, 'error': 'YouTube URL is required.'}), 400

    direct_id = extract_video_id(url)
    if direct_id:
        index = get_track_index()
        for ext in ['.mp3', '.wav', '.m4a']:
            candidate = CACHE_DIR / f"{direct_id}{ext}"
            if candidate.exists() and direct_id in index:
                return jsonify({
                    'success': True,
                    'track': {
                        **index[direct_id],
                        'audioUrl': f'/api/audio/{direct_id}'
                    }
                })

    yt_binary = str(BASE_DIR / 'bin' / 'yt-dlp')
    if not os.path.exists(yt_binary):
        yt_binary = 'yt-dlp'

    cookies_file = CACHE_DIR / 'cookies.txt'
    cookie_args = ['--cookies', str(cookies_file)] if cookies_file.exists() and cookies_file.stat().st_size > 10 else []

    try:
        # Extract metadata
        info_cmd = [yt_binary, '--dump-single-json', '--no-playlist', '--no-warnings', *cookie_args, url]
        res = subprocess.run(info_cmd, capture_output=True, text=True, check=True, timeout=35)
        info = json.loads(res.stdout)
        
        video_id = info.get('id', 'track')
        title = info.get('title', 'YouTube Track')
        duration = int(info.get('duration', 0))
        uploader = info.get('uploader', 'Unknown')

        target_file = CACHE_DIR / f"{video_id}.mp3"
        if not target_file.exists():
            download_cmd = [
                yt_binary,
                *cookie_args,
                '--js-runtimes', 'node:/usr/local/bin/node',
                '-f', 'ba/ba*/b/best',
                '-x',
                '--audio-format', 'mp3',
                '--audio-quality', '0',
                '-o', str(CACHE_DIR / f"{video_id}.%(ext)s"),
                url
            ]
            subprocess.run(download_cmd, capture_output=True, text=True, check=True, timeout=120)

        mins = duration // 60
        secs = duration % 60
        formatted = f"{mins:02d}:{secs:02d}"

        index = get_track_index()
        track_data = {
            'id': video_id,
            'title': title,
            'duration': duration,
            'durationFormatted': formatted,
            'uploader': uploader,
            'sourceUrl': url,
            'fileName': f"{video_id}.mp3"
        }
        index[video_id] = track_data
        save_track_index(index)

        return jsonify({
            'success': True,
            'track': {
                **track_data,
                'audioUrl': f'/api/audio/{video_id}'
            }
        })
    except subprocess.CalledProcessError as e:
        return jsonify({'success': False, 'error': e.stderr or 'yt-dlp failed.'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/audio/<track_id>', methods=['GET'])
def stream_audio(track_id):
    # Support .mp3, .m4a, .wav
    for ext in ['.mp3', '.m4a', '.wav']:
        file_path = CACHE_DIR / f"{track_id}{ext}"
        if file_path.exists():
            return send_from_directory(CACHE_DIR, f"{track_id}{ext}", conditional=True)
    return jsonify({'error': 'Audio file not found'}), 404

@app.route('/')
def index():
    if (BASE_DIR / 'dist' / 'index.html').exists():
        return send_from_directory(BASE_DIR / 'dist', 'index.html')
    return "FretEar backend running. Please run 'npm run build' to generate frontend bundle."

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting FretEar Python backend at http://127.0.0.1:{port}")
    if os.environ.get('AUTO_LAUNCH', '1') == '1':
        webbrowser.open(f"http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
