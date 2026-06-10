import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../.env'))


class Config:
    ANVIL_RPC = f"http://127.0.0.1:{os.getenv('ANVIL_PORT', '8545')}"
    GATEWAY_URL = os.getenv('WORKER_GATEWAY_URL', 'http://127.0.0.1:3001')
    CONCURRENCY = int(os.getenv('WORKER_CONCURRENCY', '3'))
    POLL_INTERVAL_MS = int(os.getenv('WORKER_POLL_INTERVAL_MS', '500'))
    MONGODB_URI = os.getenv('MONGODB_URI', '')
    MONGODB_DB = os.getenv('MONGODB_DB_NAME', 'arbisim')
    DATABASE_URL = os.getenv('NEONDB_URL') or os.getenv('DATABASE_URL', '')
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
    ENTRYPOINT_V06 = os.getenv('ENTRYPOINT_V06', '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789')
    ENTRYPOINT_V07 = os.getenv('ENTRYPOINT_V07', '0x0000000071727De22E5E9d8BAf0edAc6f37da032')
    SIMULATION_REGISTRY = os.getenv('SIMULATION_REGISTRY_ADDRESS', '')


config = Config()
