import uuid

from tornado.websocket import WebSocketHandler

from jupyter_server.utils import url_path_join
from jupyter_server.base.handlers import JupyterHandler

def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    # Prepend the base_url so that it works in a jupyterhub setting
    route_logger = url_path_join(base_url, "logger/(.*)")
    handlers = [(route_logger, Logger)]
    
    web_app.add_handlers(host_pattern, handlers)


class Logger(WebSocketHandler, JupyterHandler):
    clients = {}

    def open(self, id = str(uuid.uuid4())):
        #print("[LOGGER] open:", id)
        cls = self.__class__
        self.id = 'logger/{}.txt'.format(id)

        if self.contents_manager.file_exists(self.id) :
            model = self.contents_manager.get(self.id, type='file', format='text')
        
        elif self.contents_manager.dir_exists('logger') :
            model = self.contents_manager.new({"type": "file", "format": "text"}, self.id)
        
        else :
            self.contents_manager.new({"type": "directory"}, 'logger')
            model = self.contents_manager.new({"type": "file", "format": "text"}, self.id)
        
        content = model.get('content', "") or ""
        content = content.split('\n')
        cls.clients[self.id] = content
    
    def on_message(self, message):
        #print("[LOGGER] message:", self.id, message)
        cls = self.__class__
        cls.clients[self.id].append(message)
        self.contents_manager.save(
            {
                "type": "file",
                "format": "text",
                'content': '\n'.join(cls.clients[self.id])
            },
            self.id
        )

    def on_close(self):
        #print("[LOGGER] close:", self.id)
        cls = self.__class__
        cls.clients.pop(self.id)
    
    def check_origin(self, origin):
        #print("[LOGGER] check origin", origin)
        return True