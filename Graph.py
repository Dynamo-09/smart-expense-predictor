# Advanced analyses: Future prediction, Monthly analysis, Household behavior, Anomaly detection

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# Load & clean dataset
path = 'C:\Users\DESKTOP\Desktop\Household Project\group 12_Household_Item_Consumption_Predictor_raw_Dataset.csv'
df = pd.read_csv(path)

df.replace(['#', 'NA', 'N/A', 'null', 'NULL', ''], pd.NA, inplace=True)
df['Purchase_Date'] = pd.to_datetime(df['Purchase_Date'], errors='coerce')

df['Quantity'] = pd.to_numeric(df['Quantity'], errors='coerce')
df['Price'] = pd.to_numeric(df['Price'], errors='coerce')

df['Quantity'] = df['Quantity'].fillna(df['Quantity'].mean())
df['Price'] = df['Price'].fillna(df['Price'].mean())

df['YearMonth'] = df['Purchase_Date'].dt.to_period('M')
df['Date'] = df['Purchase_Date'].dt.date

# -------------------- 1️⃣ Monthly Analysis --------------------
monthly_qty = df.groupby('YearMonth')['Quantity'].sum()
monthly_price = df.groupby('YearMonth')['Price'].sum()

plt.figure()
plt.plot(monthly_qty.index.astype(str), monthly_qty.values)
plt.title("Monthly Total Quantity")
plt.xlabel("Month")
plt.ylabel("Quantity")
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()

plt.figure()
plt.plot(monthly_price.index.astype(str), monthly_price.values)
plt.title("Monthly Total Spending")
plt.xlabel("Month")
plt.ylabel("Total Price")
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()

# -------------------- 2️⃣ Future Prediction (Simple Trend Projection) --------------------
# Using linear regression on monthly spending

x = np.arange(len(monthly_price))
y = monthly_price.values

coeffs = np.polyfit(x, y, 1)  # linear trend
trend_line = np.polyval(coeffs, x)

# Predict next 3 months
future_x = np.arange(len(monthly_price) + 3)
future_trend = np.polyval(coeffs, future_x)

plt.figure()
plt.plot(monthly_price.index.astype(str), y)
plt.plot(range(len(future_trend)), future_trend)
plt.title("Spending Trend & Future Projection")
plt.xlabel("Month Index")
plt.ylabel("Total Price")
plt.tight_layout()
plt.show()

# -------------------- 3️⃣ Household-wise Behavior --------------------
household_qty = df.groupby('Household_ID')['Quantity'].sum().sort_values(ascending=False).head(10)

plt.figure()
plt.bar(household_qty.index.astype(str), household_qty.values)
plt.title("Top 10 Households by Consumption")
plt.xlabel("Household ID")
plt.ylabel("Total Quantity")
plt.tight_layout()
plt.show()

# -------------------- 4️⃣ Anomaly Detection --------------------
# Detect anomalies in daily spending using Z-score

daily_spending = df.groupby('Date')['Price'].sum()
z_scores = (daily_spending - daily_spending.mean()) / daily_spending.std()

anomalies = daily_spending[np.abs(z_scores) > 2]

plt.figure()
plt.plot(daily_spending.index, daily_spending.values)
plt.title("Daily Spending (Anomalies Hidden)")
plt.xlabel("Date")
plt.ylabel("Spending")
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()

plt.figure()
plt.bar(anomalies.index.astype(str), anomalies.values)
plt.title("Detected Spending Anomalies")
plt.xlabel("Date")
plt.ylabel("Spending Spike")
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()

print("Advanced analyses complete.")

