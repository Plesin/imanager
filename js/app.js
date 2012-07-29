(function() {
	/***--- APP INITIALIZATION ---***/

	window.App = Em.Application.create({
		name: 'Invoice Manager',
		version: '0.1',
		ready: function() {
			App.applicationController.loadData();
		}
	});

	/***--- CLASS DEFINITIONS ---***/

	App.Person = Em.Object.extend({
		id: null,
		name: null,
		address: null
	});

	App.Sender = App.Person.extend({
		bankName: null,
		accountNumber: null
	});

	App.Recipient = App.Person.extend();

	App.Invoice = Em.Object.extend({
		id: null,
		number: null,
		status: null,
		orderDate: null,
		dueDate: null,
		senderId: null,
		recipientId: null,
		items: [],
		totalPrice: function() {
			var items = this.get('items'), totalPrice = 0;
			items.forEach(function(item) {
			  totalPrice += item.get('totalPrice');
			});
			return totalPrice;
		}.property('items.@each.totalPrice').cacheable(),
		totalVatPrice: function() {
			var items = this.get('items'), totalVatPrice = 0;
			items.forEach(function(item) {
			  totalVatPrice += item.get('vatPrice');
			});
			return totalVatPrice;
		}.property('items.@each.vatPrice').cacheable()
	});

	App.InvoiceItem = Em.Object.extend({
		description: null,
		quantity: null,
		unitPrice: null,
		vat: null,
		vatPrice: function() {
			var vat = parseInt(this.get('vat')), isValidVat = vat > 0 ? true : false;
			return (this.get('unitPrice') * this.get('quantity')) * (isValidVat ? (vat / 100) : 0);
		}.property('unitPrice', 'quantity', 'vat'),
		totalPrice: function() {
			return (this.get('unitPrice') * this.get('quantity')) + this.get('vatPrice');
		}.property('unitPrice', 'quantity', 'vatPrice')
	});

	/***--- CONTROLLERS ---***/

	App.applicationController = Em.ArrayController.create({
		isLoaded: false,
		loadData: function() {
			var that = this;
			$.getJSON('json/invoices.json', function(data) {
				App.senderController.addSender(data);
				App.recipientsController.addRecipients(data);
				App.invoiceController.addInvoices(data);
				that.isLoaded = true;
				$.publish('dataLoaded', data);
			});
		},
		showHomePage: function() {
			var currentView = App.Container.get('childViews')[0];
			App.Container.get('childViews').removeObject(currentView);
		    App.Container.get('childViews').pushObject(Em.ContainerView.create({
		       childViews: ['newInvoiceButton', 'invoicesList'],
		       newInvoiceButton: App.NewInvoiceButtonView.create(),
		       invoicesList: App.InvoicesListView.create()
		   }));
		}
	});

	App.senderController = Em.ArrayController.create({
		content: [],
		addSender: function(data) {
			var sender = App.Sender.create({
				id: data.sender.id,
				name: data.sender.name,
				address: data.sender.address,
				bankName: data.sender.bankName,
				accountNumber: data.sender.accountNumber
			});
			this.pushObject(sender);
		},
		getSenderById: function(senderId) {
			var content = this.get('content'), senderObj;
			content.forEach(function(sender) {
				if (senderId === sender.id) {
			  		senderObj = sender;
			  	}
			});
			return senderObj;
		},
		getNameById: function(senderId) {
			var content = this.get('content'), userName;
			content.forEach(function(sender) {
				if (senderId === sender.id) {
			  		userName = sender.name;
			  	}
			});
			return userName;
		}
	});

	App.recipientsController = Em.ArrayController.create({
		content: [],
		addRecipient: function(data) {
			var recipient = App.Recipient.create({
				id: data.id,
				name: data.name,
				address: data.address
			});
			this.pushObject(recipient);
		},
		addRecipients: function(data) {
			var that = this;
		    $.each(data.recipients, function(index, value) {
		        that.addRecipient(data.recipients[index]);
		    });
		},
		getRecipientById: function(recipientId) {
			var content = this.get('content'), recipientObj;
			content.forEach(function(recipient) {
				if (recipientId === recipient.id) {
			  		recipientObj = recipient;
			  	}
			});
			return recipientObj;
		},
		getNameById: function(recipientId) {
			var content = this.get('content'), recipientName;
			content.forEach(function(recipient) {
				if (recipientId === recipient.id) {
			  		recipientName = recipient.name;
			  	}
			});
			return recipientName;
		}
	});

	App.invoiceController = Em.ArrayController.create({
		content: [],
		addInvoice: function(data) {
			var invoiceItems = this.getInvoiceItems(data.items), invoice;
			invoice = App.Invoice.create({
				id: data.id,
				number: data.number,
				status: data.status,
				orderDate: data.orderDate,
				dueDate: data.dueDate,
				senderId: data.senderId,
				recipientId: data.recipientId,
				items: invoiceItems
			});
			this.pushObject(invoice);
			return invoice;
		},
		addInvoices: function(data) {
		    var that = this;
		    $.each(data.invoices, function(index, value) {
		        that.addInvoice(data.invoices[index]);
		    });
		},
		getInvoiceById: function(invoiceId) {
			var content = this.get('content'), invoiceObj;
			content.forEach(function(invoice) {
				if (invoiceId === invoice.id) {
					invoiceObj = invoice;
				}
			});
			return invoiceObj;
		},
		getInvoiceItems: function(itemsArr) {
			var i, l = itemsArr.length, item, items = [];
			for (i = 0; i < l; i++) {
				item = itemsArr[i];
				items.push(
					App.InvoiceItem.create({
						description: item.description,
						quantity: item.quantity,
						unitPrice: item.unitPrice,
						vat: item.vat
					})
				);
			}
			return items;
		},
		totalDrafts: function() {
			return this.filterProperty('status', 'draft').get('length');
		}.property('@each.status'),
		totalPublished: function() {
			return this.filterProperty('status', 'published').get('length');
		}.property('@each.status'),
		totalCanceled: function() {
			return this.filterProperty('status', 'canceled').get('length');
		}.property('@each.status'),
		appendPieChart: function() {
			var r = Raphael("holder"), totalDrafts = this.get('totalDrafts'), totalPublished = this.get('totalPublished'), totalCanceled = this.get('totalCanceled'),
				pie = r.piechart(150, 150, 100, [totalDrafts, totalPublished, totalCanceled], { legend: ["%%.%% - Drafts", "%%.%% - Published", "%%.%% - Canceled"], legendpos: "east"});

		      r.text(320, 100, "").attr({ font: "20px sans-serif" });
		      pie.hover(function () {
		          this.sector.stop();
		          this.sector.scale(1.1, 1.1, this.cx, this.cy);

		          if (this.label) {
		              this.label[0].stop();
		              this.label[0].attr({ r: 7.5 });
		              this.label[1].attr({ "font-weight": 800 });
		          }
		      }, function () {
		          this.sector.animate({ transform: 's1 1 ' + this.cx + ' ' + this.cy }, 500, "bounce");

		          if (this.label) {
		              this.label[0].animate({ r: 5 }, 500, "bounce");
		              this.label[1].attr({ "font-weight": 400 });
		          }
		      });
		},
		showInvoiceDetail: function(invoice, editEnabled, isNewInvoice) {
			var sender = App.senderController.getSenderById(invoice.senderId),
		    	recipient = App.recipientsController.getRecipientById(invoice.recipientId),
		    	newItem = App.InvoiceItem.create({description: '', quantity: '0', unitPrice: '0', vat: '0',}),
		    	//this is not finished, just some hard coded values for now
		    	invoiceDetailView = App.InvoiceDetailView.create({
		    		editEnabled: editEnabled,
		    		invoice: isNewInvoice ? this.addInvoice({id: 3, number: '123', status: 'draft', orderDate: '', dueDate: '', senderId: "1", recipientId: "5001", items: [newItem]}) : invoice,
		    		sender: isNewInvoice ? App.senderController.getSenderById("1") : sender,
		    		recipient: isNewInvoice ? App.recipientsController.getRecipientById("5001") : recipient
		    	});
		    App.Container.get('childViews').removeObject(App.Container.get('childViews')[0]);
		    App.Container.get('childViews').pushObject(invoiceDetailView);
		}
	});

	/***--- VIEWS ---***/

	App.ApplicationView = Em.View.extend({
		home: function() {
			App.applicationController.showHomePage();
		}
	});

	App.NewInvoiceButtonView = Em.View.extend({
		templateName: 'new-invoice-button',
		showInvoiceDetail: function(event) {
			var editEnabled = true, isNewInvoice = ($(event.target).is('.newInvoiceButton'));
			App.invoiceController.showInvoiceDetail(event.context, editEnabled, isNewInvoice);
		}
	});

	App.ChartView = Em.View.extend({
		templateName: 'chart'
	});

	App.InvoicesListView = Em.View.extend({
		templateName: 'invoices-list',
		showInvoiceDetail: function(event) {
			var editEnabled = ($(event.target).is('.editInvoiceButton')),
				isNewInvoice = ($(event.target).is('.newInvoiceButton'));
			App.invoiceController.showInvoiceDetail(event.context, editEnabled, isNewInvoice);
		},
		didInsertElement: function() {
			if (App.applicationController.isLoaded) {
				App.invoiceController.appendPieChart();
			} else {
				$.subscribe('dataLoaded', function(data) {
					App.invoiceController.appendPieChart();
				});
			}
		}
	});

	App.InvoiceDetailView = Em.View.extend({
		templateName: 'invoice-detail',
		editEnabled: false,
		invoice: null,
		sender: null,
		recipient: null,
		newInvoiceItem: function(event) {
			var invoice = event.context,
				item = App.InvoiceItem.create({
					description: "",
					quantity: 0,
					unitPrice: 0,
					vat: 0,
				});
			App.invoiceController.getInvoiceById(invoice.id).items.pushObject(item);
		},
		home: function() {
			App.applicationController.showHomePage();
		},
		click: function(event) {
			var elem = $(event.target);
			if (elem.is('.deleteInvoiceItem')) {
				var index = $('.deleteInvoiceItem').index(event.target),
    				items = this.getPath('invoice.items'), item = items.objectAt(index);
    			items.removeObject(item);
    			elem.tooltip('hide');
			}
		},
		change: function(event) {
			var elem = $(event.target);
			if (elem.is('#status')) {
				this.invoice.set('status', elem.val());
			}
		},
		didInsertElement: function() {
			var status = this.invoice.get('status'),
				that = this;

			$('.datepicker' ).datepicker({
				showOn: 'both',
				buttonImage: 'img/calendar.png',
				dateFormat: 'dd/mm/yy',
				onSelect: function() {
					$(this).trigger('change');
				}
			});

			$("#status option[value='" + status + "']").prop('selected', true);
    		$('.deleteInvoiceItem').tooltip({ title: 'delete item', placement: 'top', delay: { show: 100, hide: 500 }});
		}
	});

	App.Container = Em.ContainerView.create({
	   childViews: ['invoicesListContainer'],
	   invoicesListContainer: Em.ContainerView.create({
	       childViews: ['newInvoiceButton', 'invoicesList'],
	       newInvoiceButton: App.NewInvoiceButtonView.create(),
	       invoicesList: App.InvoicesListView.create()
	   })
	});

	App.TextField = Ember.TextField.extend({
	    attributeBindings: ['id', 'class', 'disabled']
	});

	/***--- HANDELBARS HELPERS --***/
	Handlebars.registerHelper('getSenderNameById', function(senderId) {
		var id = Ember.getPath(this, senderId),
			senderName = App.senderController.getNameById(id);
	  	return new Handlebars.SafeString(senderName);
	});

	Handlebars.registerHelper('getRecipientNameById', function(recipientId) {
		var id = Ember.getPath(this, recipientId),
			recipientName = App.recipientsController.getNameById(id);
	  	return new Handlebars.SafeString(recipientName);
	});

	$(function() {
		App.initialize();
		App.Container.appendTo('#container');
	});

})();