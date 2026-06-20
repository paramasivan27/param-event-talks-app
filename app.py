import xml.etree.ElementTree as ET
import urllib.request
import urllib.error
import logging
from flask import Flask, render_template, jsonify

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
ATOM_NAMESPACE = {'atom': 'http://www.w3.org/2005/Atom'}

def fetch_and_parse_feed():
    try:
        # Create a request with a User-Agent to prevent getting blocked by anti-bot measures
        req = urllib.request.Request(
            FEED_URL,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        
        logger.info("Fetching release notes from feed...")
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        entries = []
        
        for entry_node in root.findall('atom:entry', ATOM_NAMESPACE):
            # Extract title (which is usually the date)
            title_node = entry_node.find('atom:title', ATOM_NAMESPACE)
            title = title_node.text.strip() if title_node is not None and title_node.text else "Unknown Date"
            
            # Extract ID
            id_node = entry_node.find('atom:id', ATOM_NAMESPACE)
            entry_id = id_node.text.strip() if id_node is not None and id_node.text else ""
            
            # Extract updated timestamp
            updated_node = entry_node.find('atom:updated', ATOM_NAMESPACE)
            updated = updated_node.text.strip() if updated_node is not None and updated_node.text else ""
            
            # Extract Link
            link_node = entry_node.find('atom:link[@rel="alternate"]', ATOM_NAMESPACE)
            if link_node is None:
                link_node = entry_node.find('atom:link', ATOM_NAMESPACE)
            link = link_node.attrib.get('href', '').strip() if link_node is not None else ""
            
            # Extract Content HTML
            content_node = entry_node.find('atom:content', ATOM_NAMESPACE)
            content = content_node.text if content_node is not None and content_node.text else ""
            
            entries.append({
                'id': entry_id,
                'title': title,
                'updated': updated,
                'link': link,
                'content': content
            })
            
        logger.info(f"Successfully parsed {len(entries)} release notes.")
        return entries, None
    except urllib.error.URLError as e:
        logger.error(f"Network error fetching feed: {str(e)}")
        return None, f"Failed to connect to the feed server: {str(e)}"
    except ET.ParseError as e:
        logger.error(f"XML parse error: {str(e)}")
        return None, f"Failed to parse release notes feed format: {str(e)}"
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return None, f"An unexpected error occurred: {str(e)}"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    notes, error = fetch_and_parse_feed()
    if error:
        return jsonify({'success': False, 'error': error}), 502
    return jsonify({'success': True, 'notes': notes})

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
