import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_async_engine(DATABASE_URL, echo=False)

async def check():
    async with engine.connect() as conn:
        # Check if table exists
        result = await conn.execute(text(
            "SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='referral_outreach')"
        ))
        exists = result.scalar()
        
        if exists:
            print('✅ referral_outreach table EXISTS\n')
            
            # Get columns
            cols = await conn.execute(text(
                "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='referral_outreach' ORDER BY ordinal_position"
            ))
            print('📋 Columns:')
            for name, dtype in cols:
                print(f'   {name:30} {dtype}')
            
            # Get row count
            count = await conn.execute(text("SELECT COUNT(*) FROM referral_outreach"))
            row_count = count.scalar()
            print(f'\n📊 Rows in table: {row_count}')
            
            # Get indexes
            indexes = await conn.execute(text(
                "SELECT indexname FROM pg_indexes WHERE tablename='referral_outreach'"
            ))
            print(f'\n🔑 Indexes:')
            for idx in indexes:
                print(f'   {idx[0]}')
        else:
            print('❌ referral_outreach table NOT FOUND')
    await engine.dispose()

asyncio.run(check())
