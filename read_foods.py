import json
import pandas as pd

#foods_updated.json
df2=pd.read_csv("food_ratings_by_condition.csv")
with open("energy_balance_wo_watch/foods_updated.json","r") as f:
    data=json.load(f)
    #dd=[]
    print(data[0])
    for item in data:
        dd=df2[df2["food_name"]==item["name"]]
        ll=["category","healthy","long_covid","me_cfs","mcas","pots","notes"]
        for it in ll:
            item[it]=dd[it].to_list()[0]
            #print(item[it])
            
        #healthy long_covid me_cfs     mcas     pots                                           notes]
    #print(item.keys())
    #print(item["nutrients"]['per100g'].keys())
    #print(item["functionalCompounds"].keys())
    print(item)
#with open("foods_updated_latest.json","w") as f0:
#    json.dump(data,f0)
    
#df=pd.DataFrame()
#df["name"]=dd
#df.to_csv("df_names.csv")


