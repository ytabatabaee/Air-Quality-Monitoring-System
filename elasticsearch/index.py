from elasticsearch import Elasticsearch

es = Elasticsearch()
if not es.indices.exists(index='iot'):
	es.indices.create(index='iot')
