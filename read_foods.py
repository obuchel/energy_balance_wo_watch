import json
import pandas as pd

#foods_updated.json

with open("foods_updated.json","r") as f:
    data=json.load(f)
    dd=[]
    for item in data:
        dd.append(item["name"])
df=pd.DataFrame()
df["name"]=dd
df.to_csv("df_names.csv")
