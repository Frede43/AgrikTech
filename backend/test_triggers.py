
import sqlite3
for d in sqlite3.connect('agriconnect.db').execute('SELECT sql FROM sqlite_master WHERE type=''trigger'''):
    print(d)

