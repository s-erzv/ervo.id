import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap } from 'lucide-react';
import AddOrderForm from '../components/AddOrderForm'; 

const QuickCompleteOrderPage = () => {
  const navigate = useNavigate();

 const handleQuickOrderSuccess = (orderId) => {
      navigate(
        `/complete-delivery/${orderId}`, 
        { 
          state: { 
            isQuickOrder: true 
          } 
        } 
      ); 
  };
  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl space-y-6"> 
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 text-[#10182b] hover:bg-gray-100 px-0">
        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
      </Button>
      
      <div className="mx-auto max-w-2xl p-0"> 
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h1 className="text-2xl font-bold flex items-center gap-2 text-yellow-700">
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6" /> Pesan Cepat 
              </h1>
          </div>
          
          <AddOrderForm onOrderSuccess={handleQuickOrderSuccess} isQuickOrderMode={true} />
      </div>
      
    </div>
  );
};

export default QuickCompleteOrderPage;