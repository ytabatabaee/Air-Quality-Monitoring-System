from elasticsearch import Elasticsearch

es = Elasticsearch(['http://localhost:9200'])
if not es.indices.exists(index='iot'):
	es.indices.create(index='iot')
